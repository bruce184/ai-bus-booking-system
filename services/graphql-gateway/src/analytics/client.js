import { gatewayError } from "../auth/errors.js";

const REQUEST_TIMEOUT_MS = 5_000;

function buildAnalyticsUrl(baseUrl, pathname, range) {
  const url = new URL(pathname, `${baseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("from", range.from);
  url.searchParams.set("to", range.to);
  return url;
}

async function requestAnalytics({ baseUrl, pathname, range, fetchImpl = fetch }) {
  let response;

  try {
    response = await fetchImpl(buildAnalyticsUrl(baseUrl, pathname, range), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw gatewayError("Analytics Service is unavailable.", "INTERNAL_ERROR");
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw gatewayError("Analytics Service returned an invalid response.", "INTERNAL_ERROR");
  }

  if (!response.ok) {
    const code = response.status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
    throw gatewayError(body?.message || "Analytics Service request failed.", code);
  }

  if (!body || typeof body !== "object") {
    throw gatewayError("Analytics Service returned an invalid response.", "INTERNAL_ERROR");
  }

  return body;
}

export function getAnalyticsRevenueSummary({ baseUrl, range, fetchImpl }) {
  return requestAnalytics({
    baseUrl,
    pathname: "/admin/revenue-summary",
    range,
    fetchImpl
  });
}

export function getAnalyticsDashboard({ baseUrl, range, fetchImpl }) {
  return requestAnalytics({
    baseUrl,
    pathname: "/admin/dashboard",
    range,
    fetchImpl
  });
}
