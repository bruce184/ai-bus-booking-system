import assert from "node:assert/strict";
import test from "node:test";
import grpc from "@grpc/grpc-js";

import { mapTripServiceError } from "../src/trip-client.js";

test("Trip Service lookup failures preserve actionable domain error codes", () => {
  assert.equal(
    mapTripServiceError({ code: grpc.status.NOT_FOUND }).code,
    "NOT_FOUND"
  );
  assert.equal(
    mapTripServiceError({ code: grpc.status.DEADLINE_EXCEEDED }).code,
    "SERVICE_TIMEOUT"
  );
  assert.equal(
    mapTripServiceError(new Error("connection refused")).code,
    "SERVICE_UNAVAILABLE"
  );
});
