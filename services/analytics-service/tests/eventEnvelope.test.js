import assert from "node:assert/strict";
import test from "node:test";

import { parseAnalyticsEvent } from "../src/kafka/eventEnvelope.js";

test("parses the canonical analytics event envelope", () => {
  const result = parseAnalyticsEvent(JSON.stringify({
    eventName: "trip.search_performed",
    payload: {
      origin: "TP.HCM",
      destination: "Da Lat",
      resultCount: 3,
      cacheHit: false
    },
    occurredAt: "2026-07-11T01:00:00.000Z"
  }));

  assert.equal(result.eventName, "trip.search_performed");
  assert.deepEqual(result.payload, {
    origin: "TP.HCM",
    destination: "Da Lat",
    resultCount: 3,
    cacheHit: false
  });
  assert.equal(result.occurredAt, "2026-07-11T01:00:00.000Z");
});

test("accepts the legacy flat search envelope only when compatibility is enabled", () => {
  const legacy = JSON.stringify({
    event: "trip.search_performed",
    origin: "TP.HCM",
    destination: "Da Lat",
    resultCount: 2,
    cacheHit: true,
    occurredAt: "2026-07-11T01:00:00.000Z"
  });

  assert.throws(() => parseAnalyticsEvent(legacy), /Unsupported analytics event envelope/);
  assert.deepEqual(parseAnalyticsEvent(legacy, { allowLegacyFlat: true }), {
    eventName: "trip.search_performed",
    payload: {
      origin: "TP.HCM",
      destination: "Da Lat",
      resultCount: 2,
      cacheHit: true
    },
    occurredAt: "2026-07-11T01:00:00.000Z"
  });
});

test("rejects malformed canonical payloads instead of silently dropping metrics", () => {
  assert.throws(
    () => parseAnalyticsEvent(JSON.stringify({
      eventName: "trip.search_performed",
      payload: null,
      occurredAt: "2026-07-11T01:00:00.000Z"
    })),
    /payload must be an object/
  );
});
