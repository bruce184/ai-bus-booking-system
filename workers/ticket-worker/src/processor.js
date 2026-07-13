import { randomUUID } from "node:crypto";
import { query, transaction } from "@bus/shared/db.js";
import { claimWorkflowEvent } from "@bus/shared/idempotency.js";
import { writeOutboxEvent } from "@bus/shared/outbox.js";

import { CHECKIN_POLICY, qrPayload, ticketCode, ticketHtml } from "./ticketContent.js";

const CONSUMER_NAME = "ticket-worker.booking-paid";

async function loadBookingContext(bookingId, runQuery = query) {
  const bookingResult = await runQuery(
    `
      select b.*, t.departure_time::text, v.vehicle_code,
             origin.name as origin_name, destination.name as destination_name,
             coalesce(pickup.name, origin.name) as pickup_point,
             coalesce(dropoff.name, destination.name) as dropoff_point
      from bookings b
      join trips t on t.id = b.trip_id
      join vehicles v on v.id = t.vehicle_id
      join routes r on r.id = t.route_id
      join locations origin on origin.id = r.origin_location_id
      join locations destination on destination.id = r.destination_location_id
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
      where b.id = $1
    `,
    [bookingId]
  );
  const booking = bookingResult.rows[0];
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const passengers = await runQuery(
    "select * from booking_passengers where booking_id = $1 order by seat_label",
    [bookingId]
  );

  return { booking, passengers: passengers.rows };
}

export async function issueTickets(
  event,
  { runQuery = query, runTransaction = transaction } = {}
) {
  const bookingId = event.payload?.bookingId;
  if (!bookingId) {
    throw new Error("booking.paid payload missing bookingId");
  }

  const eventId = event.eventId || `legacy:${event.eventName || "booking.paid"}:${bookingId}`;
  const { booking, passengers } = await loadBookingContext(bookingId, runQuery);
  const outcome = await runTransaction(async (client) => {
    if (!(await claimWorkflowEvent(client, CONSUMER_NAME, eventId))) {
      return { skipped: true, tickets: [] };
    }

    const tickets = [];
    for (let index = 0; index < passengers.length; index += 1) {
      const passenger = passengers[index];
      const existing = await client.query(
        "select * from tickets where booking_id = $1 and passenger_id = $2",
        [bookingId, passenger.id]
      );
      if (existing.rows[0]) {
        tickets.push(existing.rows[0]);
        continue;
      }

      const ticketId = randomUUID();
      const code = ticketCode(index);
      const qr = qrPayload(booking.booking_code, ticketId);
      const insert = await client.query(
        `
          insert into tickets (
            id, booking_id, passenger_id, ticket_code, qr_payload, ticket_html, checkin_policy_snapshot
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          returning *
        `,
        [
          ticketId,
          bookingId,
          passenger.id,
          code,
          qr,
          ticketHtml({ booking, passenger, trip: booking, qrPayload: qr, ticketCode: code }),
          CHECKIN_POLICY
        ]
      );
      tickets.push(insert.rows[0]);
    }

    await client.query(
      "update bookings set status = 'TICKET_ISSUED', updated_at = now() where id = $1 and status = 'PAID'",
      [bookingId]
    );
    await client.query(
      "insert into event_logs (event_type, entity_type, entity_id, payload) values ($1, $2, $3, $4)",
      [
        "ticket.issued",
        "booking",
        bookingId,
        JSON.stringify({ bookingCode: booking.booking_code, ticketCount: tickets.length })
      ]
    );
    await writeOutboxEvent(client, {
      aggregateType: "ticket",
      aggregateId: bookingId,
      eventName: "ticket.issued",
      target: "RABBITMQ",
      routingKey: "ticket.issued",
      payload: {
        bookingId,
        bookingCode: booking.booking_code,
        contactEmail: booking.contact_email,
        ticketCount: tickets.length
      }
    });

    return { skipped: false, tickets };
  });

  if (!outcome.skipped) {
    console.log(`[ticket-worker] issued ${outcome.tickets.length} ticket(s) for ${booking.booking_code}`);
  }
  return outcome;
}
