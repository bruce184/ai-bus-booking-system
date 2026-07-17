import assert from "node:assert/strict";
import test from "node:test";
import { status as grpcStatus } from "@grpc/grpc-js";

import { mapTripServiceError, mapTripSnapshot, tripServiceAddress } from "../src/trip-client.js";

test("trip client prefers the documented gRPC address", () => {
  assert.equal(
    tripServiceAddress({ TRIP_SERVICE_GRPC_ADDRESS: "trip:50051" }),
    "trip:50051"
  );
});

test("trip snapshot includes every booking policy field", () => {
  assert.deepEqual(
    mapTripSnapshot({
      trip: {
        price: 280000,
        status: "ACTIVE",
        departure_time: "2026-07-15T01:00:00.000Z"
      }
    }),
    {
      price: 280000,
      status: "ACTIVE",
      departureTime: "2026-07-15T01:00:00.000Z"
    }
  );
});

test("trip client maps deadline failures to SERVICE_TIMEOUT", () => {
  assert.deepEqual(
    mapTripServiceError({ code: grpcStatus.DEADLINE_EXCEEDED }),
    { code: "SERVICE_TIMEOUT", message: "Trip Service timed out" }
  );
});
