import assert from "node:assert/strict";
import test from "node:test";

import { handleSearchEvent } from "../src/kafka/handlers/searchEventsHandler.js";

test("handleSearchEvent writes through the caller's transaction client, not a separate pool connection", async () => {
  const calls = [];
  const fakeClient = {
    async query(text, params) {
      calls.push({ text: text.replace(/\s+/g, " ").trim().toLowerCase(), params });
      return { rows: [{}] };
    }
  };

  await handleSearchEvent({
    eventName: "trip.search_performed",
    payload: { origin: "TP.HCM", destination: "Da Lat" },
    occurredAt: "2026-06-20T10:00:00.000Z",
    client: fakeClient
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /^insert into analytics_daily/);
});

test("handleSearchEvent skips the write entirely on missing origin/destination", async () => {
  const calls = [];
  const fakeClient = { async query(text) { calls.push(text); return { rows: [{}] }; } };

  await handleSearchEvent({
    eventName: "trip.search_performed",
    payload: { origin: "", destination: "Da Lat" },
    occurredAt: "2026-06-20T10:00:00.000Z",
    client: fakeClient
  });

  assert.equal(calls.length, 0);
});
