import assert from "node:assert/strict";
import test from "node:test";

import { runMcpDemo } from "../scripts/demo-client.mjs";

test("MCP demo follows initialize, discovery, call, resource, close lifecycle", async () => {
  const order = [];
  const client = {
    async connect(transport) {
      order.push(["connect", transport.url]);
    },
    async listTools() {
      order.push(["listTools"]);
      return { tools: [{ name: "search_trips" }] };
    },
    async callTool(request) {
      order.push(["callTool", request]);
      return { content: [{ type: "text", text: "demo trips" }] };
    },
    async readResource(request) {
      order.push(["readResource", request]);
      return { contents: [{ uri: request.uri, text: "policy" }] };
    },
    async close() {
      order.push(["close"]);
    }
  };

  const result = await runMcpDemo(
    {
      baseUrl: "http://127.0.0.1:4010/mcp",
      departureDate: "2026-07-14"
    },
    {
      createClient: () => client,
      createTransport: (url) => ({ url })
    }
  );

  assert.deepEqual(result.toolNames, ["search_trips"]);
  assert.deepEqual(
    order.map(([name]) => name),
    ["connect", "listTools", "callTool", "readResource", "close"]
  );
  assert.equal(order[2][1].arguments.departureDate, "2026-07-14");
});

test("MCP demo closes the client when a protocol operation fails", async () => {
  let closed = false;
  await assert.rejects(
    runMcpDemo(
      {},
      {
        createTransport: () => ({}),
        createClient: () => ({
          async connect() {},
          async listTools() {
            throw new Error("protocol failure");
          },
          async close() {
            closed = true;
          }
        })
      }
    ),
    /protocol failure/
  );
  assert.equal(closed, true);
});
