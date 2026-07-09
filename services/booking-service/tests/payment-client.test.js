import assert from "node:assert/strict";
import test from "node:test";

import { paymentServiceUrl, simulatePaymentRequest } from "../src/payment-client.js";

test("payment client prefers the documented service URL env var", () => {
  assert.equal(
    paymentServiceUrl({
      PAYMENT_SERVICE_URL: "http://payment-service:5010/",
      PAYMENT_SERVICE_BASE_URL: "http://legacy-payment:5010"
    }),
    "http://payment-service:5010"
  );
});

test("payment client keeps the legacy base URL as fallback", () => {
  assert.equal(
    paymentServiceUrl({
      PAYMENT_SERVICE_BASE_URL: "http://legacy-payment:5010/"
    }),
    "http://legacy-payment:5010"
  );
});

test("payment client defaults to the documented local service port", () => {
  assert.equal(paymentServiceUrl({}), "http://localhost:5010");
});

test("payment simulation request uses booking-service field names", () => {
  assert.deepEqual(
    simulatePaymentRequest({
      booking: {
        id: "booking-1",
        booking_code: "BK202607090001",
        trip_id: "trip-1",
        total_amount: "280000"
      },
      success: true
    }),
    {
      bookingId: "booking-1",
      bookingCode: "BK202607090001",
      tripId: "trip-1",
      amount: 280000,
      success: true
    }
  );
});
