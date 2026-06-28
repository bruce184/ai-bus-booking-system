import assert from "node:assert/strict";
import test from "node:test";
import { Metadata, status as grpcStatus } from "@grpc/grpc-js";
import { GraphQLError } from "graphql";

import { callGrpc } from "../src/grpc/call.js";

function grpcError({ code, details, metadataCode }) {
  const error = new Error(details);
  error.code = code;
  error.details = details;

  if (metadataCode) {
    error.metadata = new Metadata();
    error.metadata.set("error-code", metadataCode);
  }

  return error;
}

function clientThatFails(error) {
  return {
    run(_request, callback) {
      callback(error);
    }
  };
}

async function expectGraphqlCode(work, code) {
  await assert.rejects(
    work,
    (error) => {
      assert.ok(error instanceof GraphQLError);
      assert.equal(error.extensions.code, code);
      return true;
    }
  );
}

test("callGrpc maps explicit service error-code metadata", async () => {
  await expectGraphqlCode(
    () => callGrpc(
      clientThatFails(grpcError({
        code: grpcStatus.FAILED_PRECONDITION,
        details: "Simulated payment failed",
        metadataCode: "PAYMENT_FAILED"
      })),
      "run",
      {}
    ),
    "PAYMENT_FAILED"
  );
});

test("callGrpc maps standard code prefixes from services without metadata", async () => {
  await expectGraphqlCode(
    () => callGrpc(
      clientThatFails(grpcError({
        code: grpcStatus.FAILED_PRECONDITION,
        details: "SEAT_NOT_AVAILABLE: Seat A01 is already held"
      })),
      "run",
      {}
    ),
    "SEAT_NOT_AVAILABLE"
  );
});

test("callGrpc keeps unavailable downstream failures internal", async () => {
  await expectGraphqlCode(
    () => callGrpc(
      clientThatFails(grpcError({
        code: grpcStatus.UNAVAILABLE,
        details: "No connection established"
      })),
      "run",
      {}
    ),
    "INTERNAL_ERROR"
  );
});
