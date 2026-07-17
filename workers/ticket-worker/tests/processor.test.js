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

async function loadContext() {
  return { booking, passengers: [passenger] };
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
    { loadContext, runTransaction: (work) => work(client) }
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
      if (sql.startsWith("select status from bookings")) return { rows: [{ status: "PAID" }] };
      if (sql.startsWith("select * from tickets")) return { rows: [] };
      if (sql.startsWith("insert into tickets")) return { rows: [{ id: "ticket-1" }] };
      return { rowCount: 1, rows: [] };
    }
  };

  const outcome = await issueTickets(
    { eventId: "event-2", eventName: "booking.paid", payload: { bookingId: booking.id } },
    { loadContext, runTransaction: (work) => work(client) }
  );

  assert.equal(outcome.skipped, false);
  assert.equal(outcome.tickets.length, 1);
  assert.equal(statements.some((sql) => sql.startsWith("insert into tickets")), true);
  assert.equal(statements.some((sql) => sql.startsWith("update bookings")), true);
  assert.equal(statements.some((sql) => sql.startsWith("insert into event_logs")), true);
  assert.equal(statements.some((sql) => sql.startsWith("insert into outbox_events")), true);
});


test("a ticket_code unique-constraint collision is retried with a fresh code instead of aborting", async () => {
  const statements = [];
  let ticketInsertAttempts = 0;
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("insert into workflow_processed_events")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("select status from bookings")) return { rows: [{ status: "PAID" }] };
      if (sql.startsWith("select * from tickets")) return { rows: [] };
      if (sql.startsWith("insert into tickets")) {
        ticketInsertAttempts += 1;
        if (ticketInsertAttempts === 1) {
          const error = new Error('duplicate key value violates unique constraint "tickets_ticket_code_key"');
          error.code = "23505";
          throw error;
        }
        return { rows: [{ id: "ticket-1" }] };
      }
      return { rowCount: 1, rows: [] };
    }
  };

  const outcome = await issueTickets(
    { eventId: "event-collision", eventName: "booking.paid", payload: { bookingId: booking.id } },
    { loadContext, runTransaction: (work) => work(client) }
  );

  assert.equal(outcome.skipped, false);
  assert.equal(outcome.tickets.length, 1);
  assert.equal(ticketInsertAttempts, 2);
  assert.equal(statements.some((sql) => sql === "rollback to savepoint ticket_code_attempt"), true);
  assert.equal(statements.some((sql) => sql.startsWith("update bookings")), true);
});

test("cancellation that wins the row lock prevents every ticket side effect", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("insert into workflow_processed_events")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("select status from bookings")) return { rows: [{ status: "CANCELLED" }] };
      throw new Error(`Unexpected statement after cancellation won: ${sql}`);
    }
  };

  const outcome = await issueTickets(
    { eventId: "event-cancelled", eventName: "booking.paid", payload: { bookingId: booking.id } },
    {
      loadContext: async () => {
        throw new Error("Cancelled booking context must not be loaded");
      },
      runTransaction: (work) => work(client)
    }
  );

  assert.deepEqual(outcome, { skipped: true, tickets: [] });
  assert.equal(statements.length, 2);
  assert.equal(statements.some((sql) => sql.startsWith("insert into tickets")), false);
  assert.equal(statements.some((sql) => sql.startsWith("insert into event_logs")), false);
  assert.equal(statements.some((sql) => sql.startsWith("insert into outbox_events")), false);
});

test("ticket issuance aborts before log and outbox if the guarded state update loses", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("insert into workflow_processed_events")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("select status from bookings")) return { rows: [{ status: "PAID" }] };
      if (sql.startsWith("select * from tickets")) return { rows: [] };
      if (sql.startsWith("insert into tickets")) return { rows: [{ id: "ticket-1" }] };
      if (sql.startsWith("update bookings")) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [] };
    }
  };

  await assert.rejects(
    issueTickets(
      { eventId: "event-state-race", eventName: "booking.paid", payload: { bookingId: booking.id } },
      { loadContext, runTransaction: (work) => work(client) }
    ),
    /left PAID state during ticket issuance/
  );

  assert.equal(statements.some((sql) => sql.startsWith("insert into event_logs")), false);
  assert.equal(statements.some((sql) => sql.startsWith("insert into outbox_events")), false);
});
