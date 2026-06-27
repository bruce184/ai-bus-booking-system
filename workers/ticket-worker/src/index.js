import { randomUUID } from "node:crypto";
import { query, transaction } from "@bus/shared/db.js";
import { createWorkflowConsumer, publishWorkflowEvent } from "@bus/shared/events.js";

const CHECKIN_POLICY =
  "Vui long co mat tai diem don truoc gio khoi hanh 30 phut va xuat trinh ma QR hoac ma ve khi check-in.";

function ticketCode(index) {
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `TK${ymd}${String(index + 1).padStart(3, "0")}${Math.floor(1000 + Math.random() * 9000)}`;
}

function ticketHtml({ booking, passenger, trip, qrPayload }) {
  const route = `${trip.origin_name} -> ${trip.destination_name}`;
  return `
    <article class="ticket">
      <h1>Ve xe ${route}</h1>
      <p><strong>Ma booking:</strong> ${booking.booking_code}</p>
      <p><strong>Hanh khach:</strong> ${passenger.full_name}</p>
      <p><strong>Ghe:</strong> ${passenger.seat_label}</p>
      <p><strong>Khoi hanh:</strong> ${trip.departure_time}</p>
      <p><strong>Xe:</strong> ${trip.vehicle_code}</p>
      <p><strong>QR:</strong> ${qrPayload}</p>
      <p>${CHECKIN_POLICY}</p>
    </article>
  `.trim();
}

async function loadBookingContext(bookingId) {
  const bookingResult = await query(
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

  const passengers = await query(
    "select * from booking_passengers where booking_id = $1 order by seat_label",
    [bookingId]
  );

  return { booking, passengers: passengers.rows };
}

async function issueTickets(event) {
  const bookingId = event.payload?.bookingId;
  if (!bookingId) {
    throw new Error("booking.paid payload missing bookingId");
  }

  const { booking, passengers } = await loadBookingContext(bookingId);
  const issuedTickets = await transaction(async (client) => {
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
      const qrPayload = `${booking.booking_code}-${ticketId}`;
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
          ticketCode(index),
          qrPayload,
          ticketHtml({ booking, passenger, trip: booking, qrPayload }),
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

    return tickets;
  });

  await publishWorkflowEvent("ticket.issued", {
    bookingId,
    bookingCode: booking.booking_code,
    contactEmail: booking.contact_email,
    ticketCount: issuedTickets.length
  });
  console.log(`[ticket-worker] issued ${issuedTickets.length} ticket(s) for ${booking.booking_code}`);
}

await createWorkflowConsumer("ticket-worker.booking-paid", ["booking.paid"], issueTickets);
console.log("[ticket-worker] waiting for booking.paid events");
