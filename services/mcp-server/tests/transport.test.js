import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CANCELLATION_POLICY_TEXT } from "@bus/shared/policies.js";

import { createMcpServer } from "../src/server.js";

async function withServer(run) {
  const app = createMcpServer();
  const httpServer = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const { port } = httpServer.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => httpServer.close(resolve));
  }
}

test("health endpoint reports the MCP service", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "mcp-server",
      scope: "process",
      dependenciesChecked: false
    });
  });
});

test("GET /mcp returns 405 when the stateless server has no SSE stream", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  });
});

test("official SDK client completes MCP initialization and discovery", async () => {
  await withServer(async (baseUrl) => {
    const client = new Client({ name: "audit-test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      const resourceList = await client.listResources();
      const policy = await client.readResource({ uri: "bus://policy/cancellation" });

      assert.equal(tools.tools.length, 5);
      const revenueTool = tools.tools.find((tool) => tool.name === "get_revenue_summary");
      assert.equal(Object.hasOwn(revenueTool.inputSchema.properties, "adminToken"), false);
      assert.equal(resourceList.resources.length, 4);
      assert.equal(policy.contents[0].text, CANCELLATION_POLICY_TEXT);
    } finally {
      await client.close();
    }
  });
});
