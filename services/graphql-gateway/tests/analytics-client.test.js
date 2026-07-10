import assert from "node:assert/strict";
import test from "node:test";
import { GraphQLError } from "graphql";

import {
  getAnalyticsDashboard,
  getAnalyticsRevenueSummary
} from "../src/analytics/client.js";
import { loadGatewayConfig } from "../src/config/env.js";

const range = { from: "2026-06-18", to: "2026-06-24" };

test("gateway config exposes the Analytics Service URL", () => {
  const config = loadGatewayConfig({ ANALYTICS_SERVICE_URL: "http://analytics.test:50056" });
  assert.equal(config.analytics.baseUrl, "http://analytics.test:50056");
});

test("analytics client requests the documented report endpoints", async () => {
  const requestedUrls = [];
  const fetchImpl = async (url, options) => {
    requestedUrls.push(String(url));
    assert.equal(options.headers.accept, "application/json");
    assert.ok(options.signal instanceof AbortSignal);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    };
  };

  await getAnalyticsRevenueSummary({
    baseUrl: "http://analytics.test:50056",
    range,
    fetchImpl
  });
  await getAnalyticsDashboard({
    baseUrl: "http://analytics.test:50056/",
    range,
    fetchImpl
  });

  assert.deepEqual(requestedUrls, [
    "http://analytics.test:50056/admin/revenue-summary?from=2026-06-18&to=2026-06-24",
    "http://analytics.test:50056/admin/dashboard?from=2026-06-18&to=2026-06-24"
  ]);
});

test("analytics client maps downstream failures to GraphQL error codes", async () => {
  await assert.rejects(
    getAnalyticsDashboard({
      baseUrl: "http://analytics.test:50056",
      range,
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: "Invalid date range" })
      })
    }),
    (error) => {
      assert.ok(error instanceof GraphQLError);
      assert.equal(error.extensions.code, "VALIDATION_ERROR");
      return true;
    }
  );

  await assert.rejects(
    getAnalyticsDashboard({
      baseUrl: "http://analytics.test:50056",
      range,
      fetchImpl: async () => {
        throw new Error("connection refused");
      }
    }),
    (error) => {
      assert.ok(error instanceof GraphQLError);
      assert.equal(error.extensions.code, "INTERNAL_ERROR");
      return true;
    }
  );
});
