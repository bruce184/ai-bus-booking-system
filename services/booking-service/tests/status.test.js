import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOKING_STATUSES,
  assertPendingPayment,
  canCancel,
  canCancelBeforeDeparture,
  canCheckIn,
  canCheckInTripState
} from "../src/status.js";

test("booking status set matches documented state names", () => {
  assert.deepEqual(
    [...BOOKING_STATUSES],
    [
      "DRAFT",
      "PENDING_PAYMENT",
      "PAID",
      "TICKET_ISSUED",
      "CHECKED_IN",
      "COMPLETED",
      "EXPIRED",
      "CANCELLED"
    ]
  );
});

test("payment is only accepted from PENDING_PAYMENT", () => {
  assert.equal(assertPendingPayment("PENDING_PAYMENT"), true);
  assert.equal(assertPendingPayment("DRAFT"), false);
  assert.equal(assertPendingPayment("PAID"), false);
});

test("cancellation follows PAID to CANCELLED transition", () => {
  assert.equal(canCancel("PAID"), true);
  assert.equal(canCancel("TICKET_ISSUED"), false);
  assert.equal(canCancel("CHECKED_IN"), false);
  assert.equal(canCancel("COMPLETED"), false);
});

test("check-in follows TICKET_ISSUED to CHECKED_IN transition", () => {
  assert.equal(canCheckIn("TICKET_ISSUED"), true);
  assert.equal(canCheckIn("PAID"), false);
  assert.equal(canCheckIn("PENDING_PAYMENT"), false);
  assert.equal(canCheckIn("CANCELLED"), false);
});

test("cancellation window matches the 24h-before-departure refund policy", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  assert.equal(canCancelBeforeDeparture("2026-06-22T12:00:00.000Z", now), true); // 48h out
  assert.equal(canCancelBeforeDeparture("2026-06-21T13:00:00.000Z", now), true); // just over 24h
  assert.equal(canCancelBeforeDeparture("2026-06-21T12:00:00.000Z", now), true); // exactly 24h
  assert.equal(canCancelBeforeDeparture("2026-06-21T00:00:00.000Z", now), false); // 12h out
  assert.equal(canCancelBeforeDeparture("2026-06-19T12:00:00.000Z", now), false); // already departed
});

test("check-in is rejected for cancelled trips only", () => {
  assert.equal(canCheckInTripState("CANCELLED"), false);
  assert.equal(canCheckInTripState("ACTIVE"), true);
  assert.equal(canCheckInTripState("LOCKED"), true);
  assert.equal(canCheckInTripState("DEPARTED"), true);
  assert.equal(canCheckInTripState("COMPLETED"), true);
});
