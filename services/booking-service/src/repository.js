import { randomUUID } from "node:crypto";
import { query, transaction } from "@bus/shared/db.js";
import { fail } from "@bus/shared/errors.js";

function bookingCode() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `BK${ymd}${Math.floor(100000 + Math.random() * 900000)}`;
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

export async function createBooking(input) {
  const passengers = input.passengers || [];
  if (!input.trip_id || !input.hold_token || !input.contact_email || passengers.length === 0) {
    fail("VALIDATION_ERROR", "trip_id, hold_token, contact_email and passengers are required");
  }

  const seatIds = passengers.map((passenger) => passenger.seat_id).filter(Boolean);
  if (seatIds.length !== passengers.length || new Set(seatIds).size !== seatIds.length) {
    fail("VALIDATION_ERROR", "Each passenger must have one unique seat_id");
  }

  return transaction(async (client) => {
    const tripResult = await client.query(
      "select price, status from trips where id = $1 for share",
      [input.trip_id]
    );
    const trip = tripResult.rows[0];
    if (!trip) {
      fail("NOT_FOUND", "Trip not found");
    }
    if (trip.status !== "ACTIVE") {
      fail("BOOKING_STATE_INVALID", "Trip is not active");
    }

    const total = Number(trip.price) * passengers.length;
    let inserted;
    for (let attempt = 0; attempt < 3; attempt += 1) {
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
        break;
      } catch (error) {
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

    return fetchBookingById(inserted.id, client);
  });
}

export async function markBookingPaid({ bookingId }) {
  return transaction(async (client) => {
    const update = await client.query(
      `
        update bookings
        set status = 'PAID', updated_at = now()
        where id = $1 and status = 'PENDING_PAYMENT'
        returning id
      `,
      [bookingId]
    );
    if (!update.rows[0]) {
      const existing = await fetchBookingById(bookingId, client);
      if (!existing) {
        fail("NOT_FOUND", "Booking not found");
      }
      return existing;
    }

    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      ["booking.paid", "booking", bookingId, JSON.stringify({ bookingId })]
    );
    return fetchBookingById(bookingId, client);
  });
}

export async function cancelBooking({ booking_code, email }) {
  return transaction(async (client) => {
    const result = await client.query(
      "select * from bookings where booking_code = $1 and lower(contact_email) = lower($2) for update",
      [booking_code, email]
    );
    const booking = result.rows[0];
    if (!booking) {
      fail("NOT_FOUND", "Booking not found");
    }
    if (booking.status !== "PAID") {
      fail("BOOKING_STATE_INVALID", "Only PAID bookings can be cancelled in the MVP");
    }

    await client.query(
      "update bookings set status = 'CANCELLED', updated_at = now() where id = $1",
      [booking.id]
    );
    await client.query(
      "update trip_seats set status = 'AVAILABLE', booking_id = null, updated_at = now() where booking_id = $1 and status = 'BOOKED'",
      [booking.id]
    );
    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      ["booking.cancelled", "booking", booking.id, JSON.stringify({ bookingCode: booking.booking_code })]
    );

    return fetchBookingById(booking.id, client);
  });
}

export async function checkInPassenger({ code, staff_user_id }) {
  if (!code) {
    fail("VALIDATION_ERROR", "code is required");
  }

  return transaction(async (client) => {
    const result = await client.query(
      `
        select distinct b.*
        from bookings b
        left join tickets tk on tk.booking_id = b.id
        where b.booking_code = $1 or tk.ticket_code = $1 or tk.qr_payload = $1
        limit 1
        for update of b
      `,
      [code]
    );
    const booking = result.rows[0];
    if (!booking) {
      fail("NOT_FOUND", "Booking or ticket not found");
    }
    if (booking.status === "CHECKED_IN") {
      return fetchBookingById(booking.id, client);
    }
    if (booking.status !== "PAID" && booking.status !== "TICKET_ISSUED") {
      fail("BOOKING_STATE_INVALID", "Only PAID or TICKET_ISSUED bookings can be checked in");
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
