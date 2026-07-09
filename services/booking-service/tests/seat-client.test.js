import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmSeatsRequest,
  releaseBookedSeatsRequest,
  releaseHoldRequest,
  seatInventoryAddress,
  validateHoldRequest
} from "../src/seat-client.js";

test("seat inventory client prefers the documented service address env var", () => {
  assert.equal(
    seatInventoryAddress({
      SEAT_INVENTORY_SERVICE_GRPC_ADDRESS: "127.0.0.1:60052",
      SEAT_INVENTORY_GRPC_URL: "127.0.0.1:50052"
    }),
    "127.0.0.1:60052"
  );
});

test("seat inventory client keeps the legacy env var as fallback", () => {
  assert.equal(
    seatInventoryAddress({
      SEAT_INVENTORY_GRPC_URL: "127.0.0.1:50052"
    }),
    "127.0.0.1:50052"
  );
});

test("seat inventory client defaults to the documented local port", () => {
  assert.equal(seatInventoryAddress({}), "localhost:50052");
});

test("seat inventory release hold request uses the documented proto field", () => {
  assert.deepEqual(
    releaseHoldRequest({ holdToken: "hold-demo-123" }),
    { hold_token: "hold-demo-123" }
  );
});

test("seat inventory validate hold request uses the documented proto fields", () => {
  assert.deepEqual(
    validateHoldRequest({
      tripId: "trip-1",
      seatIds: ["seat-1", "seat-2"],
      holdToken: "hold-demo-123"
    }),
    {
      trip_id: "trip-1",
      seat_ids: ["seat-1", "seat-2"],
      hold_token: "hold-demo-123"
    }
  );
});

test("seat inventory confirm seats request uses the documented proto fields", () => {
  assert.deepEqual(
    confirmSeatsRequest({
      tripId: "trip-1",
      seatIds: ["seat-1"],
      holdToken: "hold-demo-123",
      bookingId: "booking-1"
    }),
    {
      trip_id: "trip-1",
      seat_ids: ["seat-1"],
      hold_token: "hold-demo-123",
      booking_id: "booking-1"
    }
  );
});

test("seat inventory release booked seats request uses the documented proto fields", () => {
  assert.deepEqual(
    releaseBookedSeatsRequest({
      tripId: "trip-1",
      seatIds: ["seat-1"],
      bookingId: "booking-1"
    }),
    {
      trip_id: "trip-1",
      seat_ids: ["seat-1"],
      booking_id: "booking-1"
    }
  );
});
