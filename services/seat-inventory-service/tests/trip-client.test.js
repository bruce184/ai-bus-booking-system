import assert from "node:assert/strict";
import test from "node:test";
import grpc from "@grpc/grpc-js";

import { mapTripServiceError } from "../src/trip-client.js";

test("Trip Service lookup failures preserve actionable gRPC status", () => {
  assert.equal(
    mapTripServiceError({ code: grpc.status.NOT_FOUND }).code,
    grpc.status.NOT_FOUND
  );
  assert.equal(
    mapTripServiceError({ code: grpc.status.DEADLINE_EXCEEDED }).code,
    grpc.status.DEADLINE_EXCEEDED
  );
  assert.equal(
    mapTripServiceError(new Error("connection refused")).code,
    grpc.status.UNAVAILABLE
  );
});
