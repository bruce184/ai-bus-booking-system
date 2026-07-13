import assert from "node:assert/strict";
import test from "node:test";
import { createEventEnvelope } from "../src/events.js";

test("createEventEnvelope preserves persisted outbox identity on retry", () => {
  const metadata = {
    eventId: "8c8f4f5e-9f2a-4c1e-9a3d-2f4f7b1a6c11",
    occurredAt: "2026-07-13T01:02:03.000Z"
  };

  const first = createEventEnvelope("booking.paid", { bookingId: "booking-1" }, metadata);
  const retry = createEventEnvelope("booking.paid", { bookingId: "booking-1" }, metadata);

  assert.deepEqual(retry, first);
  assert.equal(first.eventId, metadata.eventId);
  assert.equal(first.occurredAt, metadata.occurredAt);
});

test("createEventEnvelope generates canonical metadata for direct publishers", () => {
  const envelope = createEventEnvelope("trip.search_performed", { resultCount: 2 });

  assert.match(envelope.eventId, /^[0-9a-f-]{36}$/i);
  assert.equal(envelope.eventName, "trip.search_performed");
  assert.deepEqual(envelope.payload, { resultCount: 2 });
  assert.equal(Number.isNaN(Date.parse(envelope.occurredAt)), false);
});
