import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOKING_STATUSES,
  assertPendingPayment,
  canCancel,
  canCheckIn
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
