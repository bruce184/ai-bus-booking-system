import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaymentResult,
  processPaymentSimulation
} from "../src/simulation.js";

const request = {
  bookingId: "booking-1",
  bookingCode: "BK202607130001",
  tripId: "trip-1",
  amount: "250000",
  success: true
};

test("payment result is normalized independently of analytics", () => {
  assert.deepEqual(createPaymentResult(request), {
    bookingId: "booking-1",
    bookingCode: "BK202607130001",
    tripId: "trip-1",
    amount: 250000,
    success: true
  });
});

test("payment returns without waiting for a pending Kafka publish", () => {
  const neverSettles = new Promise(() => {});
  const payment = processPaymentSimulation(request, {
    publishEvent: () => neverSettles,
    logger: { error() {} }
  });

  assert.equal(payment.success, true);
  assert.equal(payment.bookingCode, request.bookingCode);
});

test("Kafka rejection is logged without rejecting payment processing", async () => {
  const kafkaError = new Error("Kafka unavailable");
  const errors = [];
  const payment = processPaymentSimulation(request, {
    publishEvent: async () => { throw kafkaError; },
    logger: { error: (...args) => errors.push(args) }
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(payment.success, true);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /failed to publish payment\.simulated_success analytics/);
  assert.equal(errors[0][1], kafkaError);
});
