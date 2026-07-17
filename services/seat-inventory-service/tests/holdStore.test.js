import assert from "node:assert/strict";
import test from "node:test";

import {
  holdKey,
  holdSeatsAtomically,
  seatMaintenanceKey
} from "../src/redis/holdStore.js";

test("hold creation checks the trip maintenance key in the same Lua operation", async () => {
  let evalArgs;
  const client = {
    async eval(...args) {
      evalArgs = args;
      return [-1, ""];
    }
  };

  const result = await holdSeatsAtomically(
    "trip-1",
    ["seat-1", "seat-2"],
    "guest",
    "hold-1",
    300,
    { client }
  );

  assert.equal(result.maintenanceConflict, true);
  assert.equal(result.conflictSeatId, undefined);
  assert.equal(evalArgs[1], 3);
  assert.equal(evalArgs[2], seatMaintenanceKey("trip-1"));
  assert.deepEqual(evalArgs.slice(3, 5), [
    holdKey("trip-1", "seat-1"),
    holdKey("trip-1", "seat-2")
  ]);
});

test("ordinary seat conflict remains distinguishable from trip maintenance", async () => {
  const client = {
    async eval() {
      return [0, "seat-2"];
    }
  };

  const result = await holdSeatsAtomically(
    "trip-1",
    ["seat-1", "seat-2"],
    "guest",
    "hold-1",
    300,
    { client }
  );

  assert.equal(result.maintenanceConflict, undefined);
  assert.equal(result.conflictSeatId, "seat-2");
});
