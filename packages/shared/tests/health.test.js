import assert from "node:assert/strict";
import test from "node:test";
import { startHealthServer } from "../src/health.js";

test("health server reports ok for the configured service on /health and 404s elsewhere", async () => {
  const server = startHealthServer(0, "demo-service");
  const { port } = server.address();

  try {
    const healthy = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthy.status, 200);
    assert.deepEqual(await healthy.json(), { ok: true, service: "demo-service" });

    const missing = await fetch(`http://127.0.0.1:${port}/other`);
    assert.equal(missing.status, 404);
  } finally {
    server.close();
  }
});
