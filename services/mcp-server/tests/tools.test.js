import assert from "node:assert/strict";
import test from "node:test";

import { callTool, toolDefinitions } from "../src/tools.js";
import { resources } from "../src/policies.js";
import {
  CANCELLATION_POLICY_TEXT,
  CANCELLATION_POLICY_URI,
  CHECKIN_POLICY_TEXT,
  CHECKIN_POLICY_URI
} from "@bus/shared/policies.js";

test("exposes exactly the tools required by the lecturer spec", () => {
  assert.deepEqual(
    toolDefinitions.map((tool) => tool.name).sort(),
    [
      "get_booking_status",
      "get_popular_routes",
      "get_revenue_summary",
      "get_trip_detail",
      "search_trips"
    ]
  );
});

test("exposes exactly the resources required by the lecturer spec", () => {
  assert.deepEqual(
    Object.keys(resources).sort(),
    [
      "bus://policy/cancellation",
      "bus://policy/checkin",
      "bus://routes/popular",
      "bus://system/health"
    ]
  );
  assert.equal(resources[CANCELLATION_POLICY_URI].text, CANCELLATION_POLICY_TEXT);
  assert.equal(resources[CHECKIN_POLICY_URI].text, CHECKIN_POLICY_TEXT);
});

test("get_booking_status requires both booking code and email", async () => {
  await assert.rejects(
    callTool("get_booking_status", { bookingCode: "BK123" }),
    (error) => error.code === "VALIDATION_ERROR" && /email/.test(error.message)
  );
  await assert.rejects(
    callTool("get_booking_status", { email: "a@b.com" }),
    (error) => error.code === "VALIDATION_ERROR" && /bookingCode/.test(error.message)
  );
});

test("search_trips validates required fields before calling the gateway", async () => {
  await assert.rejects(
    callTool("search_trips", { origin: "TP.HCM" }),
    (error) => error.code === "VALIDATION_ERROR"
  );
});

test("get_revenue_summary rejects a wrong admin token", async () => {
  await assert.rejects(
    callTool(
      "get_revenue_summary",
      { from: "2026-07-01", to: "2026-07-11" },
      { adminToken: "wrong" }
    ),
    (error) => error.code === "FORBIDDEN"
  );
});

test("unknown tools are NOT_FOUND", async () => {
  await assert.rejects(
    callTool("delete_all_bookings", {}),
    (error) => error.code === "NOT_FOUND"
  );
});
