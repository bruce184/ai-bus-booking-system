import assert from "node:assert/strict";
import test from "node:test";

import { createMcpServer } from "../src/server.js";

async function withServer(run) {
  const server = createMcpServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /mcp returns 405, not 404, since there is no SSE stream to open", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  });
});

test("a lifecycle notification (no id) gets 202 with no JSON-RPC error body", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    });
    assert.equal(response.status, 202);
    assert.equal(await response.text(), "");
  });
});

test("a batch of only notifications is accepted as one 202", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", method: "notifications/progress" }
      ])
    });
    assert.equal(response.status, 202);
  });
});

test("a normal request with an id still gets its JSON-RPC result", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, 1);
    assert.ok(Array.isArray(body.result.tools));
  });
});
