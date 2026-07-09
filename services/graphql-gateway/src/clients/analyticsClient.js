import { config } from "../config.js";

async function getJson(path, params) {
  const url = new URL(path, config.analyticsServiceUrl);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message ?? "Analytics Service request failed");
    error.extensions = { code: body.error ?? "INTERNAL_ERROR" };
    throw error;
  }

  return body;
}

export function fetchRevenueSummary(input) {
  return getJson("/admin/revenue-summary", input);
}

export function fetchAnalyticsDashboard(input) {
  return getJson("/admin/dashboard", input);
}

export function fetchPopularRoutes({ limit = 5 } = {}) {
  return getJson("/popular-routes", { limit });
}
