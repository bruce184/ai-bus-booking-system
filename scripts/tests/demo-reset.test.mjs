import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const resetSql = readFileSync("database/reset-demo.sql", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("demo reset reapplies schema and seed around a complete mutable-table truncate", () => {
  assert.match(resetSql, /\\ir schema\.sql/);
  assert.match(resetSql, /\\ir seed\.sql/);
  for (const table of [
    "workflow_processed_events",
    "processed_events",
    "outbox_events",
    "event_logs",
    "tickets",
    "booking_passengers",
    "saved_passengers",
    "bookings",
    "trip_seats",
    "route_stops",
    "trips",
    "routes",
    "vehicle_seats",
    "vehicles",
    "locations",
    "users",
    "analytics_daily"
  ]) {
    assert.match(resetSql, new RegExp(`\\b${table}\\b`));
  }
});

test("data reset clears Redis without a fixed container name", () => {
  const command = packageJson.scripts["demo:reset:data"];
  assert.match(command, /docker compose exec -T postgres/);
  assert.match(command, /redis-cli FLUSHDB/);
  assert.doesNotMatch(command, /docker exec bus-/);
});
