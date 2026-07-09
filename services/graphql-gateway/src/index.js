import http from "node:http";
import { config } from "./config.js";
import { analyticsResolvers } from "./resolvers/analyticsResolvers.js";

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

function contextFromRequest(req) {
  const role = req.headers["x-demo-role"];
  return role ? { user: { role: String(role).toUpperCase() } } : {};
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function executeSupportedQuery({ query = "", variables = {} }, context) {
  const root = analyticsResolvers.Query;

  if (query.includes("adminRevenueSummary")) {
    return {
      data: {
        adminRevenueSummary: await root.adminRevenueSummary(null, { input: variables.input }, context)
      }
    };
  }

  if (query.includes("adminAnalyticsDashboard")) {
    return {
      data: {
        adminAnalyticsDashboard: await root.adminAnalyticsDashboard(null, { input: variables.input }, context)
      }
    };
  }

  if (query.includes("popularRoutes")) {
    return {
      data: {
        popularRoutes: await root.popularRoutes(null, { limit: variables.limit }, context)
      }
    };
  }

  return {
    errors: [
      {
        message:
          "This baseline gateway scaffold currently executes analytics queries only. Add the full GraphQL runtime as other services land.",
        extensions: { code: "NOT_IMPLEMENTED" }
      }
    ]
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, service: "graphql-gateway" });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/graphql") {
    json(res, 404, { error: "NOT_FOUND" });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(req));
    json(res, 200, await executeSupportedQuery(payload, contextFromRequest(req)));
  } catch (error) {
    json(res, 200, {
      errors: [
        {
          message: error.message,
          extensions: error.extensions ?? { code: "INTERNAL_ERROR" }
        }
      ]
    });
  }
});

server.listen(config.port, () => {
  console.log(`[graphql-gateway] listening on ${config.port}`);
});
