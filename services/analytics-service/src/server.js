import http from "node:http";
import {
  getDailyRevenue,
  getPopularRoutes,
  getRevenueSummary,
  getTicketsByRoute
} from "./repository/analyticsRepository.js";
import { checkPostgres } from "./db/postgres.js";

function json(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function getDateRange(searchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    const error = new Error("from and to query parameters are required");
    error.statusCode = 400;
    throw error;
  }

  return { from, to };
}

export function createAnalyticsServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        const postgres = await checkPostgres();
        json(res, 200, { ok: true, service: "analytics-service", postgres });
        return;
      }

      if (req.method === "GET" && url.pathname === "/admin/revenue-summary") {
        json(res, 200, await getRevenueSummary(getDateRange(url.searchParams)));
        return;
      }

      if (req.method === "GET" && url.pathname === "/admin/dashboard") {
        const range = getDateRange(url.searchParams);
        const [revenueSummary, dailyRevenue, ticketsByRoute, popularRoutes] = await Promise.all([
          getRevenueSummary(range),
          getDailyRevenue(range),
          getTicketsByRoute(range),
          getPopularRoutes({ ...range, limit: 5 })
        ]);

        json(res, 200, {
          revenueSummary,
          dailyRevenue,
          ticketsByRoute,
          popularRoutes
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/popular-routes") {
        const range = {
          from: url.searchParams.get("from") ?? "1970-01-01",
          to: url.searchParams.get("to") ?? "2999-12-31",
          limit: Number.parseInt(url.searchParams.get("limit") ?? "5", 10)
        };
        json(res, 200, await getPopularRoutes(range));
        return;
      }

      json(res, 404, { error: "NOT_FOUND" });
    } catch (error) {
      json(res, error.statusCode ?? 500, {
        error: error.statusCode === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
        message: error.message
      });
    }
  });
}
