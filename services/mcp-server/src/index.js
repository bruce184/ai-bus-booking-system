import "dotenv/config";
import http from "node:http";
import { config } from "./config.js";
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

async function handleRpc(message) {
  const { id, method, params = {} } = message;

  try {
    if (method === "initialize") {
      return result(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "intercity-bus-booking-mcp", version: "0.1.0" },
        capabilities: { tools: {}, resources: {} }
      });
    }

    if (method === "tools/list") {
      return result(id, { tools: toolDefinitions });
    }

    if (method === "tools/call") {
      return result(id, await callTool(params.name, params.arguments ?? {}));
    }

    if (method === "resources/list") {
      return result(id, {
        resources: Object.entries(resources).map(([uri, resource]) => ({
          uri,
          name: resource.name,
          mimeType: resource.mimeType
        }))
      });
    }

    if (method === "resources/read") {
      const resource = resources[params.uri];
      if (!resource) {
        throw Object.assign(new Error(`Unknown resource: ${params.uri}`), { code: "NOT_FOUND" });
      }
      return result(id, {
        contents: [{ uri: params.uri, mimeType: resource.mimeType, text: resource.text }]
      });
    }

    return failure(id, new Error(`Unsupported method: ${method}`));
  } catch (error) {
    return failure(id, error);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, service: "mcp-server" });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/mcp") {
    send(res, 404, { error: "NOT_FOUND" });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(req));
    if (Array.isArray(payload)) {
      send(res, 200, await Promise.all(payload.map(handleRpc)));
      return;
    }
    send(res, 200, await handleRpc(payload));
  } catch (error) {
    send(res, 400, failure(null, error));
  }
});

server.listen(config.port, () => {
  console.log(`[mcp-server] MCP HTTP transport listening on ${config.port}/mcp`);
});
