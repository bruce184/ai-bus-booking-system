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
    run(_request, _options, callback) {
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

test("callGrpc passes a deadline so calls cannot hang forever", async () => {
  let seenOptions = null;
  const client = {
    run(_request, options, callback) {
      seenOptions = options;
      callback(null, { ok: true });
    }
  };

  const before = Date.now();
  await callGrpc(client, "run", {}, { timeoutMs: 2000 });

  assert.ok(seenOptions.deadline instanceof Date);
  assert.ok(seenOptions.deadline.getTime() >= before + 2000);
  assert.ok(seenOptions.deadline.getTime() <= Date.now() + 2000);
});

test("callGrpc maps DEADLINE_EXCEEDED to SERVICE_TIMEOUT", async () => {
  await expectGraphqlCode(
    () => callGrpc(
      clientThatFails(grpcError({
        code: grpcStatus.DEADLINE_EXCEEDED,
        details: "Deadline exceeded"
      })),
      "run",
      {}
    ),
    "SERVICE_TIMEOUT"
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
