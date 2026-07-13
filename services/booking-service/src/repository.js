import { randomUUID } from "node:crypto";
import { compactBusinessDate } from "@bus/shared/date.js";
import { query, transaction } from "@bus/shared/db.js";
import { fail } from "@bus/shared/errors.js";
import { writeOutboxEvent } from "@bus/shared/outbox.js";
import { fetchTripSnapshot } from "./trip-client.js";
import { canCancel, canCancelBeforeDeparture, canCheckIn, canCheckInTripState } from "./status.js";

export function bookingCode(now = new Date()) {
  const ymd = compactBusinessDate(now);
  return `BK${ymd}${Math.floor(100000 + Math.random() * 900000)}`;
}

function normalizedText(value) {
  return String(value ?? "").trim();
}

function normalizedEmail(value) {
  return normalizedText(value).toLowerCase();
}

function normalizedPassenger(passenger, fallbackEmail = "") {
  return {
    fullName: normalizedText(passenger.full_name),
    phone: normalizedText(passenger.phone),
    email: normalizedEmail(passenger.email || fallbackEmail),
    documentNumber: normalizedText(passenger.document_number),
    seatId: normalizedText(passenger.seat_id)
  };
}

function normalizedPassengers(passengers, fallbackEmail = "") {
  return passengers
    .map((passenger) => normalizedPassenger(passenger, fallbackEmail))
    .sort((left, right) => left.seatId.localeCompare(right.seatId));
}

function validateCreateBookingInput(input) {
  const passengers = input.passengers || [];
  if (!input.trip_id || !input.hold_token || !input.contact_email || passengers.length === 0) {
    fail("VALIDATION_ERROR", "trip_id, hold_token, contact_email and passengers are required");
  }

  const normalized = normalizedPassengers(passengers, input.contact_email);
  if (normalized.some((passenger) => !passenger.fullName || !passenger.seatId)) {
    fail("VALIDATION_ERROR", "Each passenger must have full_name and seat_id");
  }

  const seatIds = normalized.map((passenger) => passenger.seatId);
  if (new Set(seatIds).size !== seatIds.length) {
    fail("VALIDATION_ERROR", "Each passenger must have one unique seat_id");
  }

  return { passengers, seatIds };
}

export function bookingRequestMatches(booking, input) {
  const existingPassengers = normalizedPassengers(booking.passengers || [], booking.contact_email);
  const requestedPassengers = normalizedPassengers(input.passengers || [], input.contact_email);

  return (
    normalizedText(booking.trip_id) === normalizedText(input.trip_id) &&
    normalizedText(booking.hold_token) === normalizedText(input.hold_token) &&
    normalizedText(booking.customer_user_id) === normalizedText(input.customer_user_id) &&
    normalizedEmail(booking.contact_email) === normalizedEmail(input.contact_email) &&
    normalizedText(booking.contact_phone) === normalizedText(input.contact_phone) &&
    JSON.stringify(existingPassengers) === JSON.stringify(requestedPassengers)
  );
}

function assertHoldTokenBindingMatches(booking, input) {
  if (!bookingRequestMatches(booking, input)) {
    fail("BOOKING_STATE_INVALID", "Hold token is already bound to another booking request");
  }
}

export function isPaymentSettledStatus(status) {
  return ["PAID", "TICKET_ISSUED", "CHECKED_IN", "COMPLETED"].includes(status);
}

function ticketRouteColumns() {
  return `
    coalesce(origin.name || ' -> ' || destination.name, '') as route_label,
    coalesce(pickup.name, origin.name, '') as pickup_point,
    coalesce(dropoff.name, destination.name, '') as dropoff_point,
    t.departure_time::text as departure_time,
    coalesce(v.vehicle_code, v.license_plate, '') as vehicle_code
  `;
}

function mapPassenger(row) {
  return {
    full_name: row.full_name,
    phone: row.phone || "",
    email: row.email || "",
    document_number: row.document_number || "",
    seat_id: row.seat_label
  };
}

function mapTicket(row, booking) {
  return {
    id: row.id,
    ticket_code: row.ticket_code,
    booking_code: booking.booking_code,
    passenger_name: row.passenger_name,
    route_label: row.route_label || "",
    pickup_point: row.pickup_point || "",
    dropoff_point: row.dropoff_point || "",
    departure_time: row.departure_time || "",
    seat_id: row.seat_label,
    vehicle_code: row.vehicle_code || "",
    qr_payload: row.qr_payload,
    checkin_policy: row.checkin_policy_snapshot || "",
    html: row.ticket_html || "",
    pdf_url: row.ticket_pdf_url || ""
  };
}

export async function fetchBookingById(id, client = { query }) {
  const bookingResult = await client.query(
    "select * from bookings where id = $1",
    [id]
  );
  const booking = bookingResult.rows[0];
  if (!booking) {
    return null;
  }

  const passengerResult = await client.query(
    "select * from booking_passengers where booking_id = $1 order by seat_label",
    [booking.id]
  );
  const ticketResult = await client.query(
    `
      select tk.*, bp.full_name as passenger_name, bp.seat_label,
             ${ticketRouteColumns()}
      from tickets tk
      join booking_passengers bp on bp.id = tk.passenger_id
      join bookings b on b.id = tk.booking_id
      join trips t on t.id = b.trip_id
      join routes r on r.id = t.route_id
      join locations origin on origin.id = r.origin_location_id
      join locations destination on destination.id = r.destination_location_id
      join vehicles v on v.id = t.vehicle_id
      left join lateral (
        select l.name
        from route_stops rs
        join locations l on l.id = rs.location_id
        where rs.route_id = r.id and rs.stop_type = 'PICKUP'
        order by rs.stop_order
        limit 1
      ) pickup on true
      left join lateral (
        select l.name
        from route_stops rs
        join locations l on l.id = rs.location_id
        where rs.route_id = r.id and rs.stop_type = 'DROPOFF'
        order by rs.stop_order
        limit 1
      ) dropoff on true
      where tk.booking_id = $1
      order by bp.seat_label
    `,
    [booking.id]
  );

  return {
    id: booking.id,
    booking_code: booking.booking_code,
    status: booking.status,
    trip_id: booking.trip_id,
    hold_token: booking.hold_token || "",
    customer_user_id: booking.customer_user_id || "",
    contact_email: booking.contact_email,
    contact_phone: booking.contact_phone || "",
    total_amount: Number(booking.total_amount),
    passengers: passengerResult.rows.map(mapPassenger),
    tickets: ticketResult.rows.map((row) => mapTicket(row, booking))
  };
}

export async function fetchBookingByCode(code) {
  const result = await query("select id from bookings where booking_code = $1", [code]);
  return result.rows[0] ? fetchBookingById(result.rows[0].id) : null;
}

export async function getBookingStatus({ booking_code, email }) {
  if (!booking_code || !email) {
    fail("VALIDATION_ERROR", "booking_code and email are required");
  }

  const result = await query(
    "select id from bookings where booking_code = $1 and lower(contact_email) = lower($2)",
    [booking_code, email]
  );

  if (!result.rows[0]) {
    fail("NOT_FOUND", "Booking not found");
  }

  return fetchBookingById(result.rows[0].id);
}

export async function findBookingByHoldToken(input) {
  validateCreateBookingInput(input);
  const result = await query(
    "select id from bookings where hold_token = $1 order by created_at, id limit 2",
    [input.hold_token]
  );

  if (result.rows.length > 1) {
    fail("INTERNAL_ERROR", "Hold token is bound to multiple bookings");
  }
  if (!result.rows[0]) {
    return null;
  }

  const booking = await fetchBookingById(result.rows[0].id);
  assertHoldTokenBindingMatches(booking, input);
  return booking;
}

export async function createBooking(
  input,
  { runTransaction = transaction, getTripSnapshot = fetchTripSnapshot } = {}
) {
  const { passengers, seatIds } = validateCreateBookingInput(input);

  // trip_id is unauthenticated client input and Trip Service owns that data
  // (no physical FK across service boundaries - see docs/ARCHITECTURE.md
  // section 11), so existence/price/status come from its API, fetched
  // before opening a DB transaction rather than mid-transaction.
  const trip = await getTripSnapshot(input.trip_id);
  if (trip.status !== "ACTIVE") {
    fail("BOOKING_STATE_INVALID", "Trip is not active");
  }

  return runTransaction(async (client) => {
    await client.query(
      "select pg_advisory_xact_lock(hashtext('booking-hold'), hashtext($1))",
      [input.hold_token]
    );

    const existingResult = await client.query(
      "select id from bookings where hold_token = $1 order by created_at, id for update",
      [input.hold_token]
    );
    if (existingResult.rows.length > 1) {
      fail("INTERNAL_ERROR", "Hold token is bound to multiple bookings");
    }
    if (existingResult.rows[0]) {
      const existing = await fetchBookingById(existingResult.rows[0].id, client);
      assertHoldTokenBindingMatches(existing, input);
      return { booking: existing, created: false };
    }

    const total = Number(trip.price) * passengers.length;
    let inserted;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await client.query("savepoint booking_code_attempt");
      try {
        const result = await client.query(
          `
            insert into bookings (
              booking_code, customer_user_id, trip_id, hold_token, contact_email, contact_phone, status, total_amount
            )
            values ($1, nullif($2, '')::uuid, $3, $4, $5, $6, 'PENDING_PAYMENT', $7)
            returning *
          `,
          [
            bookingCode(),
            input.customer_user_id || "",
            input.trip_id,
            input.hold_token,
            input.contact_email,
            input.contact_phone || null,
            total
          ]
        );
        inserted = result.rows[0];
        await client.query("release savepoint booking_code_attempt");
        break;
      } catch (error) {
        await client.query("rollback to savepoint booking_code_attempt");
        if (error.code !== "23505" || attempt === 2) {
          throw error;
        }
      }
    }

    for (const passenger of passengers) {
      await client.query(
        `
          insert into booking_passengers (
            booking_id, full_name, phone, email, document_number, seat_label
          )
          values ($1, $2, $3, $4, $5, $6)
        `,
        [
          inserted.id,
          passenger.full_name,
          passenger.phone || null,
          passenger.email || input.contact_email,
          passenger.document_number || null,
          passenger.seat_id
        ]
      );
    }

    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      [
        "booking.created",
        "booking",
        inserted.id,
        JSON.stringify({ bookingCode: inserted.booking_code, tripId: input.trip_id, seatIds })
      ]
    );
    await writeOutboxEvent(client, {
      aggregateType: "booking",
      aggregateId: inserted.id,
      eventName: "booking.created",
      target: "KAFKA",
      routingKey: "booking-events",
      payload: {
        bookingId: inserted.id,
        bookingCode: inserted.booking_code,
        tripId: inserted.trip_id,
        totalAmount: Number(inserted.total_amount),
        passengerCount: passengers.length
      }
    });

    return {
      booking: await fetchBookingById(inserted.id, client),
      created: true
    };
  });
}

export async function settleBookingPayment(
  { bookingCode, email, success, processPayment },
  { runTransaction = transaction } = {}
) {
  return runTransaction(async (client) => {
    // FOR NO KEY UPDATE (not FOR UPDATE): Seat Inventory sets
    // trip_seats.booking_id while this transaction is still open, and that
    // FK check takes FOR KEY SHARE on this row. FOR UPDATE would block it
    // until the gRPC deadline; NO KEY UPDATE still serializes settlements.
    const locked = await client.query(
      `
        select id
        from bookings
        where booking_code = $1
        for no key update
      `,
      [bookingCode]
    );
    if (!locked.rows[0]) {
      fail("NOT_FOUND", "Booking not found");
    }

    const booking = await fetchBookingById(locked.rows[0].id, client);
    // Same bookingCode+email pairing GetBookingStatus/CancelBooking require:
    // whoever is on the payment page must know both, not just the code.
    if (normalizedEmail(booking.contact_email) !== normalizedEmail(email)) {
      fail("NOT_FOUND", "Booking not found");
    }
    if (success && isPaymentSettledStatus(booking.status)) {
      return { booking, transitioned: false };
    }
    if (booking.status !== "PENDING_PAYMENT") {
      fail("BOOKING_STATE_INVALID", `Cannot pay booking in ${booking.status} status`);
    }

    await processPayment(booking);

    const update = await client.query(
      `
        update bookings
        set status = 'PAID', updated_at = now()
        where id = $1 and status = 'PENDING_PAYMENT'
        returning id
      `,
      [booking.id]
    );
    if (!update.rows[0]) {
      fail("BOOKING_STATE_INVALID", "Booking payment state changed during settlement");
    }

    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      ["booking.paid", "booking", booking.id, JSON.stringify({ bookingId: booking.id })]
    );

    const paidBooking = await fetchBookingById(booking.id, client);
    const paidEventPayload = {
      bookingId: paidBooking.id,
      bookingCode: paidBooking.booking_code,
      tripId: paidBooking.trip_id,
      contactEmail: paidBooking.contact_email,
      totalAmount: paidBooking.total_amount,
      seatIds: paidBooking.passengers.map((passenger) => passenger.seat_id)
    };
    // ticket-worker and email-worker consume this from RabbitMQ; analytics
    // consumes the Kafka copy. Same payload, two brokers, one transaction.
    await writeOutboxEvent(client, {
      aggregateType: "booking",
      aggregateId: paidBooking.id,
      eventName: "booking.paid",
      target: "RABBITMQ",
      routingKey: "booking.paid",
      payload: paidEventPayload
    });
    await writeOutboxEvent(client, {
      aggregateType: "booking",
      aggregateId: paidBooking.id,
      eventName: "booking.paid",
      target: "KAFKA",
      routingKey: "booking-events",
      payload: paidEventPayload
    });

    return {
      booking: paidBooking,
      transitioned: true
    };
  });
}

export async function cancelBooking(
  { booking_code, email },
  { runQuery = query, runTransaction = transaction, getTripSnapshot = fetchTripSnapshot } = {}
) {
  const candidateResult = await runQuery(
    `select id, trip_id, status from bookings where booking_code = $1 and lower(contact_email) = lower($2)`,
    [booking_code, email]
  );
  const candidate = candidateResult.rows[0];
  if (!candidate) {
    fail("NOT_FOUND", "Booking not found");
  }
  if (!canCancel(candidate.status)) {
    fail("BOOKING_STATE_INVALID", "Only PAID bookings can be cancelled");
  }

  const trip = await getTripSnapshot(candidate.trip_id);
  if (!canCancelBeforeDeparture(trip.departureTime)) {
    fail(
      "BOOKING_STATE_INVALID",
      "Cancellation is only allowed more than 24 hours before departure"
    );
  }

  return runTransaction(async (client) => {
    const result = await client.query(
      `
        select *
        from bookings
        where id = $1
        for update
      `,
      [candidate.id]
    );
    const booking = result.rows[0];
    if (!booking) {
      fail("NOT_FOUND", "Booking not found");
    }
    if (!canCancel(booking.status)) {
      fail("BOOKING_STATE_INVALID", "Only PAID bookings can be cancelled");
    }

    await client.query(
      "update bookings set status = 'CANCELLED', updated_at = now() where id = $1",
      [booking.id]
    );
    // Seat state is owned by Seat Inventory: the caller releases booked seats
    // through the ReleaseBookedSeats RPC after this transaction commits.
    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      ["booking.cancelled", "booking", booking.id, JSON.stringify({ bookingCode: booking.booking_code })]
    );
    await writeOutboxEvent(client, {
      aggregateType: "booking",
      aggregateId: booking.id,
      eventName: "booking.cancelled",
      target: "KAFKA",
      routingKey: "booking-events",
      payload: {
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        tripId: booking.trip_id
      }
    });

    return fetchBookingById(booking.id, client);
  });
}

export async function expirePendingBookings(ageSeconds = 300, { bookingIds = null } = {}) {
  return transaction(async (client) => {
    const result = await client.query(
      `
        select id, booking_code, trip_id, hold_token
        from bookings
        where status = 'PENDING_PAYMENT'
          and created_at < now() - $1 * interval '1 second'
          and ($2::uuid[] is null or id = any($2::uuid[]))
        for update skip locked
      `,
      [ageSeconds, bookingIds]
    );

    const expiredBookings = result.rows;
    if (expiredBookings.length === 0) {
      return [];
    }

    const ids = expiredBookings.map((b) => b.id);

    await client.query(
      `
        update bookings
        set status = 'EXPIRED', updated_at = now()
        where id = any($1::uuid[])
      `,
      [ids]
    );

    const seatsResult = await client.query(
      `
        select booking_id, seat_label
        from booking_passengers
        where booking_id = any($1::uuid[])
      `,
      [ids]
    );

    const seatsByBooking = seatsResult.rows.reduce((acc, row) => {
      const seats = acc.get(row.booking_id) ?? [];
      seats.push(row.seat_label);
      acc.set(row.booking_id, seats);
      return acc;
    }, new Map());

    const expiredList = expiredBookings.map((b) => ({
      bookingId: b.id,
      bookingCode: b.booking_code,
      tripId: b.trip_id,
      holdToken: b.hold_token || "",
      seatIds: seatsByBooking.get(b.id) ?? []
    }));

    for (const b of expiredList) {
      await client.query(
        `
          insert into event_logs (event_type, entity_type, entity_id, payload)
          values ($1, $2, $3, $4)
        `,
        [
          "booking.expired",
          "booking",
          b.bookingId,
          JSON.stringify({ bookingCode: b.bookingCode, seatIds: b.seatIds })
        ]
      );
      await writeOutboxEvent(client, {
        aggregateType: "booking",
        aggregateId: b.bookingId,
        eventName: "booking.expired",
        target: "RABBITMQ",
        routingKey: "booking.expired",
        payload: {
          bookingId: b.bookingId,
          bookingCode: b.bookingCode,
          tripId: b.tripId,
          holdToken: b.holdToken,
          seatIds: b.seatIds
        }
      });
    }

    return expiredList;
  });
}

export async function checkInPassenger(
  { code, staff_user_id },
  { runQuery = query, runTransaction = transaction, getTripSnapshot = fetchTripSnapshot } = {}
) {
  if (!code) {
    fail("VALIDATION_ERROR", "code is required");
  }

  const candidateResult = await runQuery(
    `
      select b.id, b.trip_id, b.status
      from bookings b
      where b.id = (
        select b2.id
        from bookings b2
        left join tickets tk on tk.booking_id = b2.id
        where b2.booking_code = $1 or tk.ticket_code = $1 or tk.qr_payload = $1
        limit 1
      )
    `,
    [code]
  );
  const candidate = candidateResult.rows[0];
  if (!candidate) {
    fail("NOT_FOUND", "Booking or ticket not found");
  }

  if (candidate.status !== "CHECKED_IN") {
    const trip = await getTripSnapshot(candidate.trip_id);
    if (!canCheckInTripState(trip.status)) {
      fail("BOOKING_STATE_INVALID", "Cannot check in a booking for a cancelled trip");
    }
  }

  return runTransaction(async (client) => {
    const result = await client.query(
      `
        select *
        from bookings
        where id = $1
        for update
      `,
      [candidate.id]
    );
    const booking = result.rows[0];
    if (!booking) {
      fail("NOT_FOUND", "Booking or ticket not found");
    }
    if (booking.status === "CHECKED_IN") {
      return fetchBookingById(booking.id, client);
    }
    if (!canCheckIn(booking.status)) {
      fail("BOOKING_STATE_INVALID", "Only TICKET_ISSUED bookings can be checked in");
    }

    await client.query(
      "update bookings set status = 'CHECKED_IN', updated_at = now() where id = $1",
      [booking.id]
    );
    await client.query(
      "update tickets set checked_in_at = coalesce(checked_in_at, now()) where booking_id = $1",
      [booking.id]
    );
    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      [
        "ticket.checked_in",
        "booking",
        booking.id,
        JSON.stringify({ bookingCode: booking.booking_code, staffUserId: staff_user_id || null })
      ]
    );
    await writeOutboxEvent(client, {
      aggregateType: "booking",
      aggregateId: booking.id,
      eventName: "ticket.checked_in",
      target: "KAFKA",
      routingKey: "checkin-events",
      payload: {
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        tripId: booking.trip_id
      }
    });

    return fetchBookingById(booking.id, client);
  });
}

export async function listCustomerBookings({ customer_user_id }) {
  if (!customer_user_id) {
    fail("UNAUTHORIZED", "customer_user_id is required");
  }
  const result = await query(
    "select id from bookings where customer_user_id = $1 order by created_at desc",
    [customer_user_id]
  );
  const bookings = await Promise.all(result.rows.map((row) => fetchBookingById(row.id)));
  return { bookings, total: bookings.length };
}

export async function listAdminBookings({ trip_id, status, email, booking_code, limit = 20, offset = 0 }) {
  const params = [];
  const where = [];

  if (trip_id) {
    params.push(trip_id);
    where.push(`trip_id = $${params.length}`);
  }
  if (status && status !== "BOOKING_STATUS_UNSPECIFIED") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (email) {
    params.push(`%${email}%`);
    where.push(`contact_email ilike $${params.length}`);
  }
  if (booking_code) {
    params.push(booking_code);
    where.push(`booking_code = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const countResult = await query(`select count(*)::int as total from bookings ${whereSql}`, params);
  params.push(Math.max(1, Number(limit) || 20), Math.max(0, Number(offset) || 0));
  const result = await query(
    `select id from bookings ${whereSql} order by created_at desc limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const bookings = await Promise.all(result.rows.map((row) => fetchBookingById(row.id)));
  return { bookings, total: countResult.rows[0].total };
}

export async function listEventLogs({ event_type, entity_type, limit = 20, offset = 0 }) {
  const params = [];
  const where = [];

  if (event_type) {
    params.push(event_type);
    where.push(`lower(event_type) = lower($${params.length})`);
  }

  if (entity_type) {
    params.push(entity_type);
    where.push(`lower(entity_type) = lower($${params.length})`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  params.push(Math.min(100, Math.max(1, Number(limit) || 20)));
  params.push(Math.max(0, Number(offset) || 0));

  const result = await query(
    `
      select id, event_type, entity_type, entity_id, payload, created_at::text as created_at
      from event_logs
      ${whereSql}
      order by created_at desc
      limit $${params.length - 1}
      offset $${params.length}
    `,
    params
  );

  return {
    logs: result.rows.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      entity_type: row.entity_type || "",
      entity_id: row.entity_id || "",
      payload: JSON.stringify(row.payload || {}),
      created_at: row.created_at
    }))
  };
}

export async function savePassengerProfile(input) {
  if (!input.customer_user_id || !input.full_name) {
    fail("VALIDATION_ERROR", "customer_user_id and full_name are required");
  }

  const id = input.id || randomUUID();
  const result = await query(
    `
      insert into saved_passengers (id, customer_user_id, full_name, phone, email, document_number)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update
      set full_name = excluded.full_name,
          phone = excluded.phone,
          email = excluded.email,
          document_number = excluded.document_number
      returning *
    `,
    [
      id,
      input.customer_user_id,
      input.full_name,
      input.phone || null,
      input.email || null,
      input.document_number || null
    ]
  );
  return { passenger: result.rows[0] };
}

export async function deletePassengerProfile({ customer_user_id, id }) {
  if (!customer_user_id || !id) {
    fail("VALIDATION_ERROR", "customer_user_id and id are required");
  }

  const result = await query(
    "delete from saved_passengers where customer_user_id = $1 and id = $2",
    [customer_user_id, id]
  );
  return { deleted: result.rowCount > 0 };
}

export async function listPassengerProfiles({ customer_user_id }) {
  if (!customer_user_id) {
    fail("UNAUTHORIZED", "customer_user_id is required");
  }

  const result = await query(
    "select * from saved_passengers where customer_user_id = $1 order by created_at desc",
    [customer_user_id]
  );
  return { passengers: result.rows };
}

// Internal RPC for Analytics Service (see proto/booking.proto): the metrics
// it needs to reverse a booking.cancelled aggregate, without a direct SQL
// join into these tables from another service.
export async function getBookingMetrics({ booking_id }) {
  if (!booking_id) {
    fail("VALIDATION_ERROR", "booking_id is required");
  }

  const result = await query(
    `
      select
        b.total_amount as total_amount,
        count(bp.id)::int as ticket_count,
        (
          select min(el.created_at)
          from event_logs el
          where el.event_type = 'booking.paid'
            and el.entity_type = 'booking'
            and el.entity_id = b.id
        ) as paid_at
      from bookings b
      left join booking_passengers bp on bp.booking_id = b.id
      where b.id = $1
      group by b.total_amount
    `,
    [booking_id]
  );

  const row = result.rows[0];
  if (!row) {
    return { total_amount: 0, ticket_count: 0, paid_at: "" };
  }

  return {
    total_amount: Number(row.total_amount) || 0,
    ticket_count: Number(row.ticket_count) || 0,
    paid_at: row.paid_at ? new Date(row.paid_at).toISOString() : ""
  };
}
