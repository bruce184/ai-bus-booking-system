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

function countingClient(handler) {
  const client = { calls: 0 };
  client.run = (_request, _options, callback) => {
    client.calls += 1;
    handler(callback);
  };
  return client;
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

test("circuit breaker opens after the failure threshold and stops calling the client", async () => {
  const client = countingClient((callback) =>
    callback(grpcError({ code: grpcStatus.UNAVAILABLE, details: "down" }))
  );
  const opts = { circuitFailureThreshold: 2, circuitCooldownMs: 60_000 };

  await assert.rejects(callGrpc(client, "run", {}, opts)); // failure 1
  await assert.rejects(callGrpc(client, "run", {}, opts)); // failure 2 -> opens
  assert.equal(client.calls, 2);

  await expectGraphqlCode(() => callGrpc(client, "run", {}, opts), "SERVICE_TIMEOUT");
  assert.equal(client.calls, 2, "client.run must not be invoked while the breaker is open");
});

test("circuit breaker half-opens after cooldown and closes on a successful trial", async () => {
  let shouldFail = true;
  const client = countingClient((callback) =>
    shouldFail
      ? callback(grpcError({ code: grpcStatus.UNAVAILABLE, details: "down" }))
      : callback(null, { ok: true })
  );
  const opts = { circuitFailureThreshold: 1, circuitCooldownMs: 10 };

  await assert.rejects(callGrpc(client, "run", {}, opts)); // opens immediately (threshold 1)
  await new Promise((resolve) => setTimeout(resolve, 20)); // let the cooldown elapse

  shouldFail = false;
  const response = await callGrpc(client, "run", {}, opts); // half-open trial
  assert.deepEqual(response, { ok: true });

  const response2 = await callGrpc(client, "run", {}, opts); // breaker closed again
  assert.deepEqual(response2, { ok: true });
  assert.equal(client.calls, 3);
});

test("circuit breaker ignores business-logic failures - only connectivity failures count", async () => {
  const client = countingClient((callback) =>
    callback(grpcError({ code: grpcStatus.NOT_FOUND, details: "missing" }))
  );
  const opts = { circuitFailureThreshold: 1, circuitCooldownMs: 60_000 };

  await expectGraphqlCode(() => callGrpc(client, "run", {}, opts), "NOT_FOUND");
  await expectGraphqlCode(() => callGrpc(client, "run", {}, opts), "NOT_FOUND");
  assert.equal(client.calls, 2, "NOT_FOUND must not trip the breaker even past the failure threshold");
});
