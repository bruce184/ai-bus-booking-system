import assert from "node:assert/strict";
import test from "node:test";
import { businessDate, compactBusinessDate, formatDateInTimeZone } from "../src/date.js";
import { createEventEnvelope } from "../src/events.js";

test("business dates use Asia/Ho_Chi_Minh instead of the UTC calendar date", () => {
  const afterLocalMidnight = new Date("2026-07-13T17:30:00.000Z");

  assert.equal(formatDateInTimeZone(afterLocalMidnight), "2026-07-14");
  assert.equal(businessDate(afterLocalMidnight, 1), "2026-07-15");
  assert.equal(compactBusinessDate(afterLocalMidnight), "20260714");
});

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
