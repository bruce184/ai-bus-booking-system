import assert from "node:assert/strict";
import test from "node:test";

import {
  expirationNotificationFlags,
  parseExpiredHoldKey,
  publishExpiredHold
} from "../src/redis/holdExpiryPublisher.js";

test("expired hold keys preserve trip and seat identity", () => {
  assert.deepEqual(parseExpiredHoldKey("hold:trip-1:seat-2"), {
    tripId: "trip-1",
    seatId: "seat-2"
  });
  assert.equal(parseExpiredHoldKey("hold-token:token-1"), null);
  assert.equal(parseExpiredHoldKey("seat-maintenance:trip-1"), null);
});

test("Redis notification flags preserve existing features and enable expiry events", () => {
  assert.equal(expirationNotificationFlags("Kg"), "KgEx");
  assert.equal(expirationNotificationFlags("Ex"), "Ex");
});

test("hold expiry publishes the canonical workflow event shape", async () => {
  const calls = [];
  const published = await publishExpiredHold("hold:trip-1:seat-2", {
    publish: async (...args) => calls.push(args)
  });

  assert.equal(published, true);
  assert.deepEqual(calls, [[
    "seat.hold_expired",
    { tripId: "trip-1", seatId: "seat-2" },
    { routingKey: "seat.hold_expired" }
  ]]);
});
