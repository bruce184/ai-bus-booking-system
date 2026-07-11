import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { toMetricDate } from "../src/utils/date.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
process.env.KAFKA_BROKERS ||= "localhost:9092";

const {
  closeEvents,
  initEvents,
  publishSearchPerformed
} = await import("../../trip-service/src/events.js");

const { Pool } = pg;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking";
const requestedTimeoutMs = Number.parseInt(
  process.env.ANALYTICS_INTEGRATION_TIMEOUT_MS || "15000",
  10
);
const timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
  ? requestedTimeoutMs
  : 15_000;
const suffix = `${Date.now()}-${process.pid}`;
const origin = `Integration Origin ${suffix}`;
const destination = `Integration Destination ${suffix}`;
const routeLabel = `${origin} -> ${destination}`;
const metricDate = toMetricDate();
const pool = new Pool({ connectionString: databaseUrl });

async function removeTestProjection() {
  await pool.query(
    "delete from analytics_daily where metric_date = $1::date and route_label = $2",
    [metricDate, routeLabel]
  );
}

async function waitForProjection() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      `select search_count
         from analytics_daily
        where metric_date = $1::date and route_label = $2`,
      [metricDate, routeLabel]
    );

    if (Number(rows[0]?.search_count || 0) >= 1) {
      return;
    }

    await delay(250);
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for Analytics Service to consume trip.search_performed`
  );
}

try {
  await removeTestProjection();
  await initEvents();
  await publishSearchPerformed({
    origin,
    destination,
    departureDate: metricDate,
    resultCount: 1,
    cacheHit: false
  });
  await waitForProjection();
  console.log("Trip producer -> Analytics consumer integration test passed");
} finally {
  await closeEvents();
  await removeTestProjection().catch(() => {});
  await pool.end();
}
