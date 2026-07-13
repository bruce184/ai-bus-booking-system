import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { config } from "./config.js";
import { resources } from "./policies.js";
import { callTool, toolDefinitions } from "./tools.js";

const toolSchemas = {
  search_trips: {
    origin: z.string().min(1),
    destination: z.string().min(1),
    departureDate: z.string().min(1),
    minAvailableSeats: z.number().nonnegative().optional()
  },
  get_trip_detail: { tripId: z.string().min(1) },
  get_booking_status: {
    bookingCode: z.string().min(1),
    email: z.string().email()
  },
  get_revenue_summary: {
    from: z.string().min(1),
    to: z.string().min(1)
  },
  get_popular_routes: { limit: z.number().int().positive().optional() }
};

export function createProtocolServer() {
  const server = new McpServer({
    name: "intercity-bus-booking-mcp",
    version: "0.1.0"
  });

  for (const definition of toolDefinitions) {
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: toolSchemas[definition.name]
      },
      (args, extra) => callTool(definition.name, args, { adminToken: extra.authInfo?.token })
    );
  }

  for (const [uri, resource] of Object.entries(resources)) {
    server.registerResource(
      resource.name,
      uri,
      { mimeType: resource.mimeType },
      async () => ({
        contents: [{ uri, mimeType: resource.mimeType, text: resource.text }]
      })
    );
  }

  return server;
}

function attachBearerAuth(req, _res, next) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    req.auth = {
      token: authorization.slice("Bearer ".length),
      clientId: "mcp-http-client",
      scopes: []
    };
  }
  next();
}

export function createMcpServer() {
  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts.length ? config.allowedHosts : undefined
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "mcp-server" });
  });

  app.use("/mcp", attachBearerAuth);
  app.post("/mcp", async (req, res) => {
    const protocolServer = createProtocolServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    try {
      await protocolServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[mcp-server] transport request failed", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: "Internal server error" }
        });
      }
    } finally {
      const cleanup = await Promise.allSettled([
        transport.close(),
        protocolServer.close()
      ]);
      for (const result of cleanup) {
        if (result.status === "rejected") {
          console.error(
            "[mcp-server] transport cleanup failed",
            result.reason
          );
        }
      }
    }
  });

  app.get("/mcp", (_req, res) => {
    res.set("allow", "POST");
    res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method not allowed" }
    });
  });

  app.delete("/mcp", (_req, res) => {
    res.set("allow", "POST");
    res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method not allowed" }
    });
  });

  return app;
}
