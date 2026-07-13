import assert from "node:assert/strict";
import test from "node:test";

import { startTripCompletedConsumer } from "../src/consumers/tripCompletedConsumer.js";
import { completeCheckedInBookings } from "../src/consumers/tripCompletedProcessor.js";

test("trip completion advances only checked-in bookings and queues canonical updates", async () => {
  const outboxPayloads = [];
  const statements = [];
  const client = {
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push({ sql, params });
      if (sql.startsWith("insert into workflow_processed_events")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("update bookings")) {
        assert.match(sql, /where trip_id = \$1 and status = 'checked_in'/);
        return {
          rowCount: 2,
          rows: [
            { id: "booking-1", booking_code: "BK1", contact_email: "one@example.com" },
            { id: "booking-2", booking_code: "BK2", contact_email: "two@example.com" }
          ]
        };
      }
      if (sql.startsWith("insert into event_logs")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("insert into outbox_events")) {
        outboxPayloads.push({
          eventName: params[2],
          target: params[3],
          routingKey: params[4],
          payload: JSON.parse(params[5])
        });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const result = await completeCheckedInBookings(
    {
      eventId: "event-1",
      eventName: "trip.completed",
      payload: { tripId: "trip-1" }
    },
    { runTransaction: (work) => work(client) }
  );

  assert.deepEqual(result, { skipped: false, completedCount: 2 });
  assert.deepEqual(outboxPayloads, [
    {
      eventName: "booking.completed",
      target: "RABBITMQ",
      routingKey: "booking.completed",
      payload: {
        bookingId: "booking-1",
        bookingCode: "BK1",
        contactEmail: "one@example.com",
        tripId: "trip-1"
      }
    },
    {
      eventName: "booking.completed",
      target: "RABBITMQ",
      routingKey: "booking.completed",
      payload: {
        bookingId: "booking-2",
        bookingCode: "BK2",
        contactEmail: "two@example.com",
        tripId: "trip-1"
      }
    }
  ]);
  assert.equal(
    statements.filter(({ sql }) => sql.startsWith("insert into event_logs")).length,
    2
  );
});

test("duplicate trip completion is claimed idempotently before any booking update", async () => {
  const statements = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("insert into workflow_processed_events")) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error("duplicate event must not mutate bookings");
    }
  };

  const result = await completeCheckedInBookings(
    { eventId: "event-1", payload: { tripId: "trip-1" } },
    { runTransaction: (work) => work(client) }
  );

  assert.deepEqual(result, { skipped: true, completedCount: 0 });
  assert.equal(statements.length, 1);
});

test("consumer uses one durable queue for trip.completed", async () => {
  let registration;
  await startTripCompletedConsumer({
    consume: async (queue, routingKeys, handler) => {
      registration = { queue, routingKeys, handler };
    }
  });

  assert.equal(registration.queue, "booking-service.trip-completed");
  assert.deepEqual(registration.routingKeys, ["trip.completed"]);
  assert.equal(registration.handler, completeCheckedInBookings);
});
