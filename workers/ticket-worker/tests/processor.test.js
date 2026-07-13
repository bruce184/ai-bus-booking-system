import assert from "node:assert/strict";
import test from "node:test";

import { issueTickets } from "../src/processor.js";

const booking = {
  id: "00000000-0000-4000-8005-000000000001",
  booking_code: "BK202607140001",
  contact_email: "guest@example.com",
  departure_time: "2026-07-15T01:00:00.000Z",
  vehicle_code: "BUS-01",
  origin_name: "TP.HCM",
  destination_name: "Da Lat",
  pickup_point: "Mien Dong",
  dropoff_point: "Da Lat"
};

const passenger = {
  id: "00000000-0000-4000-8006-000000000001",
  full_name: "Passenger A",
  seat_label: "A01"
};

function contextQuery() {
  let call = 0;
  return async () => {
    call += 1;
    return call === 1 ? { rows: [booking] } : { rows: [passenger] };
  };
}

test("duplicate booking.paid delivery is skipped before ticket writes", async () => {
  const statements = [];
  const client = {
    async query(text) {
      statements.push(text.replace(/\s+/g, " ").trim().toLowerCase());
      return { rowCount: 0, rows: [] };
    }
  };

  const outcome = await issueTickets(
    { eventId: "event-1", eventName: "booking.paid", payload: { bookingId: booking.id } },
    { runQuery: contextQuery(), runTransaction: (work) => work(client) }
  );

  assert.deepEqual(outcome, { skipped: true, tickets: [] });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /^insert into workflow_processed_events/);
});

test("ticket rows, state, log, and ticket.issued outbox event share one transaction", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("insert into workflow_processed_events")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("select * from tickets")) return { rows: [] };
      if (sql.startsWith("insert into tickets")) return { rows: [{ id: "ticket-1" }] };
      return { rowCount: 1, rows: [] };
    }
  };

  const outcome = await issueTickets(
    { eventId: "event-2", eventName: "booking.paid", payload: { bookingId: booking.id } },
    { runQuery: contextQuery(), runTransaction: (work) => work(client) }
  );

  assert.equal(outcome.skipped, false);
  assert.equal(outcome.tickets.length, 1);
  assert.equal(statements.some((sql) => sql.startsWith("insert into tickets")), true);
  assert.equal(statements.some((sql) => sql.startsWith("update bookings")), true);
  assert.equal(statements.some((sql) => sql.startsWith("insert into event_logs")), true);
  assert.equal(statements.some((sql) => sql.startsWith("insert into outbox_events")), true);
});
