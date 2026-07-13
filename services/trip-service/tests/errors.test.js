import assert from "node:assert/strict";
import test from "node:test";
import grpc from "@grpc/grpc-js";

import {
  mapDatabaseError,
  wrap
} from "../src/errors.js";

test("known PostgreSQL input constraints map to stable gRPC statuses", () => {
  assert.equal(mapDatabaseError({ code: "23505" }).grpcCode, grpc.status.INVALID_ARGUMENT);
  assert.equal(mapDatabaseError({ code: "23514" }).grpcCode, grpc.status.INVALID_ARGUMENT);
  assert.equal(mapDatabaseError({ code: "22P02" }).grpcCode, grpc.status.INVALID_ARGUMENT);
  assert.equal(mapDatabaseError({ code: "23503" }).grpcCode, grpc.status.FAILED_PRECONDITION);
  assert.equal(mapDatabaseError({ code: "08006" }), null);
});

test("handler wrapper returns a safe constraint error without logging INTERNAL", async () => {
  const logged = [];
  const handler = wrap(
    "CreateRoute",
    async () => {
      const error = new Error("duplicate key details must stay private");
      error.code = "23505";
      throw error;
    },
    { error: (...args) => logged.push(args) }
  );

  const result = await new Promise((resolve) => {
    handler(
      { request: {} },
      (error, value) => resolve({ error, value })
    );
  });

  assert.equal(result.value, undefined);
  assert.equal(result.error.code, grpc.status.INVALID_ARGUMENT);
  assert.equal(result.error.message, "Duplicate catalog value");
  assert.deepEqual(logged, []);
});
