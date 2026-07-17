import assert from "node:assert/strict";
import test from "node:test";

import { dispatchOutboxEvents } from "../src/outbox.js";

test("dispatcher claims only owned aggregate rows with skip-locked semantics", async () => {
  const statements = [];
  const published = [];
  const client = {
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push({ sql, params });
      if (sql.startsWith("select * from outbox_events")) {
        return {
          rows: [{
            id: "event-row-1",
            event_id: "event-1",
            event_name: "booking.paid",
            aggregate_type: "booking",
            target: "RABBITMQ",
            routing_key: "booking.paid",
            payload: { bookingId: "booking-1" },
            occurred_at: "2026-07-13T01:02:03.000Z"
          }]
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      statements.push({ sql: "release", params: [] });
    }
  };

  const selected = await dispatchOutboxEvents({
    aggregateTypes: ["booking", "booking"],
    limit: 500,
    database: { connect: async () => client },
    publishWorkflow: async (...args) => published.push(args)
  });

  assert.equal(selected, 1);
  assert.match(statements[1].sql, /aggregate_type = any\(\$1::text\[\]\)/);
  assert.match(statements[1].sql, /for update skip locked/);
  assert.deepEqual(statements[1].params, [["booking"], 100]);
  assert.deepEqual(published, [[
    "booking.paid",
    { bookingId: "booking-1" },
    {
      eventId: "event-1",
      occurredAt: "2026-07-13T01:02:03.000Z",
      routingKey: "booking.paid",
      correlationId: null
    }
  ]]);
  assert.equal(
    statements.some(({ sql }) => sql.startsWith("update outbox_events set published_at")),
    true
  );
  assert.equal(statements.at(-2).sql, "commit");
  assert.equal(statements.at(-1).sql, "release");
});

test("dispatcher requires explicit aggregate ownership before opening the database", async () => {
  let connected = false;
  await assert.rejects(
    dispatchOutboxEvents({
      database: {
        connect: async () => {
          connected = true;
        }
      }
    }),
    /requires at least one owned aggregateType/
  );
  assert.equal(connected, false);
});

test("failed publication leaves the row unpublished for retry", async () => {
  const statements = [];
  const errors = [];
  const client = {
    async query(text) {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(sql);
      if (sql.startsWith("select * from outbox_events")) {
        return {
          rows: [{
            id: "event-row-2",
            event_id: "event-2",
            event_name: "trip.completed",
            aggregate_type: "trip",
            target: "RABBITMQ",
            routing_key: "trip.completed",
            payload: { tripId: "trip-1" },
            occurred_at: "2026-07-13T01:02:03.000Z"
          }]
        };
      }
      return { rows: [] };
    },
    release() {}
  };

  await dispatchOutboxEvents({
    aggregateTypes: ["trip"],
    database: { connect: async () => client },
    publishWorkflow: async () => {
      throw new Error("broker unavailable");
    },
    onError: (message) => errors.push(message)
  });

  assert.equal(
    statements.some((sql) => sql.startsWith("update outbox_events set published_at")),
    false
  );
  assert.match(errors[0], /broker unavailable/);
  assert.equal(statements.at(-1), "commit");
});
