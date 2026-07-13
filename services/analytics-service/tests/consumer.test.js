import assert from "node:assert/strict";
import test from "node:test";

import { processAnalyticsMessage } from "../src/kafka/consumer.js";

const SEARCH_TOPIC = "search-events";

function canonicalMessage(overrides = {}) {
  return {
    value: Buffer.from(JSON.stringify({
      eventId: "8c8f4f5e-9f2a-4c1e-9a3d-2f4f7b1a6c11",
      eventName: "trip.search_performed",
      payload: { origin: "TP.HCM", destination: "Da Lat" },
      occurredAt: "2026-07-11T01:00:00.000Z",
      ...overrides
    }))
  };
}

function silentLogger() {
  return { error() {}, warn() {}, log() {} };
}

test("processing failures reject eachMessage so Kafka does not commit the offset", async () => {
  const databaseError = new Error("database temporarily unavailable");

  await assert.rejects(
    processAnalyticsMessage(
      { topic: SEARCH_TOPIC, message: canonicalMessage() },
      {
        handlers: { [SEARCH_TOPIC]: async () => { throw databaseError; } },
        runTransaction: async (callback) => callback({}),
        markProcessed: async () => true,
        logger: silentLogger()
      }
    ),
    databaseError
  );
});

test("malformed envelopes are rejected without retrying a deterministic poison message", async () => {
  let transactionCalled = false;

  const result = await processAnalyticsMessage(
    { topic: SEARCH_TOPIC, message: { value: Buffer.from("not-json") } },
    {
      handlers: { [SEARCH_TOPIC]: async () => {} },
      runTransaction: async () => { transactionCalled = true; },
      logger: silentLogger()
    }
  );

  assert.deepEqual(result, { status: "rejected", reason: "malformed-envelope" });
  assert.equal(transactionCalled, false);
});

test("duplicate canonical eventIds skip the aggregate handler", async () => {
  let handlerCalled = false;

  const result = await processAnalyticsMessage(
    { topic: SEARCH_TOPIC, message: canonicalMessage() },
    {
      handlers: { [SEARCH_TOPIC]: async () => { handlerCalled = true; } },
      runTransaction: async (callback) => callback({}),
      markProcessed: async () => false,
      logger: silentLogger()
    }
  );

  assert.deepEqual(result, { status: "ignored", reason: "duplicate-event" });
  assert.equal(handlerCalled, false);
});
