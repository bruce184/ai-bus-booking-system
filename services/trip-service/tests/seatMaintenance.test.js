import assert from "node:assert/strict";
import test from "node:test";

import {
  SeatMaintenanceStoreError,
  seatMaintenanceKey,
  withTripSeatMaintenanceClient
} from "../src/cache.js";

test("seat maintenance holds the owned Redis lock until work completes", async () => {
  const calls = [];
  let lockPresent = false;
  const client = {
    async set(key, token, px, ttl, nx) {
      calls.push(["set", key, px, ttl, nx]);
      lockPresent = true;
      assert.equal(typeof token, "string");
      return "OK";
    },
    async scan() {
      calls.push(["scan"]);
      return ["0", []];
    },
    async eval(_script, keyCount, key) {
      const operation = calls.some((entry) => entry[0] === "renew") ? "release" : "renew";
      calls.push([operation, keyCount, key]);
      if (operation === "release") lockPresent = false;
      return 1;
    }
  };

  const result = await withTripSeatMaintenanceClient(client, "trip-1", async (refresh) => {
    assert.equal(lockPresent, true);
    calls.push(["work"]);
    await refresh();
    return "committed";
  });

  assert.deepEqual(result, {
    acquired: true,
    hasActiveHolds: false,
    value: "committed"
  });
  assert.equal(lockPresent, false);
  assert.deepEqual(calls.map((entry) => entry[0]), ["set", "scan", "work", "renew", "release"]);
  assert.equal(calls[0][1], seatMaintenanceKey("trip-1"));
});

test("seat maintenance rejects topology work when any Redis hold exists", async () => {
  let workCalled = false;
  const client = {
    async set() {
      return "OK";
    },
    async scan() {
      return ["0", ["hold:trip-1:seat-1"]];
    },
    async eval() {
      return 1;
    }
  };

  const result = await withTripSeatMaintenanceClient(client, "trip-1", async () => {
    workCalled = true;
  });

  assert.deepEqual(result, {
    acquired: true,
    hasActiveHolds: true
  });
  assert.equal(workCalled, false);
});

test("seat maintenance does not run work when another owner holds the lock", async () => {
  let workCalled = false;
  const client = {
    async set() {
      return null;
    }
  };

  const result = await withTripSeatMaintenanceClient(client, "trip-1", async () => {
    workCalled = true;
  });

  assert.deepEqual(result, {
    acquired: false,
    hasActiveHolds: false
  });
  assert.equal(workCalled, false);
});

test("seat maintenance refuses commit work after losing lease ownership", async () => {
  let evalCount = 0;
  const client = {
    async set() {
      return "OK";
    },
    async scan() {
      return ["0", []];
    },
    async eval() {
      evalCount += 1;
      return 0;
    }
  };

  await assert.rejects(
    withTripSeatMaintenanceClient(client, "trip-1", async (refresh) => {
      await refresh();
      return "must-not-commit";
    }),
    (error) => error instanceof SeatMaintenanceStoreError
  );
  assert.equal(evalCount, 2);
});
