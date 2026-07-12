import http from "node:http";
import { resources } from "./policies.js";
import { callTool, toolDefinitions } from "./tools.js";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function result(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}

function failure(id, error) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: error.code === "FORBIDDEN" ? -32003 : -32000,
      message: error.message
    }
  };
}

export async function handleRpc(message) {
  const { id, method, params = {} } = message;
  // JSON-RPC 2.0: a message with no id is a notification (e.g. the standard
  // MCP lifecycle call notifications/initialized) - it gets no response at
  // all, success or failure, not an error reply.
  const notification = id === undefined || id === null;

  try {
    let value;

    if (method === "initialize") {
      value = {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "intercity-bus-booking-mcp", version: "0.1.0" },
        capabilities: { tools: {}, resources: {} }
      };
    } else if (method === "tools/list") {
      value = { tools: toolDefinitions };
    } else if (method === "tools/call") {
      value = await callTool(params.name, params.arguments ?? {});
    } else if (method === "resources/list") {
      value = {
        resources: Object.entries(resources).map(([uri, resource]) => ({
          uri,
          name: resource.name,
          mimeType: resource.mimeType
        }))
      };
    } else if (method === "resources/read") {
      const resource = resources[params.uri];
      if (!resource) {
        throw Object.assign(new Error(`Unknown resource: ${params.uri}`), { code: "NOT_FOUND" });
      }
      value = {
        contents: [{ uri: params.uri, mimeType: resource.mimeType, text: resource.text }]
      };
    } else if (notification) {
      return null;
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }

    return notification ? null : result(id, value);
  } catch (error) {
    return notification ? null : failure(id, error);
  }
}

export function createMcpServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true, service: "mcp-server" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/mcp") {
      // This transport has no server-initiated SSE stream to open; 405 tells
      // a standard MCP client to stick to plain POST request/response
      // instead of failing initialization on a 404.
      res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "POST" });
      res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
      return;
    }

    if (req.method !== "POST" || url.pathname !== "/mcp") {
      send(res, 404, { error: "NOT_FOUND" });
      return;
    }

    try {
      const payload = JSON.parse(await readBody(req));

      if (Array.isArray(payload)) {
        const responses = (await Promise.all(payload.map(handleRpc))).filter((entry) => entry !== null);
        if (responses.length === 0) {
          res.writeHead(202);
          res.end();
          return;
        }
        send(res, 200, responses);
        return;
      }

      const response = await handleRpc(payload);
      if (response === null) {
        res.writeHead(202);
        res.end();
        return;
      }
      send(res, 200, response);
    } catch (error) {
      send(res, 400, failure(null, error));
    }
  });
}
