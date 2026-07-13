import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HTTP_TIMEOUT_MS,
  fetchWithTimeout,
  httpTimeoutMs,
  withHttpDeadline
} from "../src/http.js";

test("HTTP timeout configuration accepts only the documented bounded range", () => {
  assert.equal(httpTimeoutMs("2500"), 2500);
  assert.equal(httpTimeoutMs("99"), DEFAULT_HTTP_TIMEOUT_MS);
  assert.equal(httpTimeoutMs("120001"), DEFAULT_HTTP_TIMEOUT_MS);
  assert.equal(httpTimeoutMs("5000ms"), DEFAULT_HTTP_TIMEOUT_MS);
  assert.equal(httpTimeoutMs("not-a-number"), DEFAULT_HTTP_TIMEOUT_MS);
});

test("fetchWithTimeout always supplies an abort signal and preserves request options", async () => {
  let received;
  const response = { ok: true };
  const result = await fetchWithTimeout(
    "http://example.test/health",
    { method: "POST", headers: { accept: "application/json" } },
    {
      timeoutMs: 250,
      fetchImpl: async (input, init) => {
        received = { input, init };
        return response;
      }
    }
  );

  assert.equal(result, response);
  assert.equal(received.input, "http://example.test/health");
  assert.equal(received.init.method, "POST");
  assert.equal(received.init.signal instanceof AbortSignal, true);
  assert.equal(received.init.signal.aborted, false);
});

test("withHttpDeadline combines caller cancellation with the deadline", () => {
  const controller = new AbortController();
  const init = withHttpDeadline({ signal: controller.signal }, 1_000);
  assert.notEqual(init.signal, controller.signal);
  controller.abort(new Error("caller cancelled"));
  assert.equal(init.signal.aborted, true);
});

test("fetchWithTimeout rejects a missing fetch implementation", () => {
  assert.throws(
    () => fetchWithTimeout("http://example.test", {}, { fetchImpl: null }),
    /fetch implementation is required/
  );
});
