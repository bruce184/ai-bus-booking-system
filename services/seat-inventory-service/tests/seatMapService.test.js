import assert from "node:assert/strict";
import test from "node:test";

import { holdSeats } from "../src/services/seatMapService.js";

const request = {
  tripId: "trip-1",
  seatIds: ["A01"],
  requesterId: "guest"
};
const availableSeats = [
  {
    id: "A01",
    label: "A01",
    deck: 1,
    row: 1,
    column: 1,
    status: "AVAILABLE"
  }
];

function dependencies(overrides = {}) {
  return {
    getTripStatus: async () => "ACTIVE",
    loadSeats: async () => availableSeats,
    createHold: async () => ({
      maintenanceConflict: false,
      conflictSeatId: "",
      expiresAt: "2026-07-13T09:05:00.000Z"
    }),
    discardHold: async () => true,
    ...overrides
  };
}

test("hold creation rejects a trip that is not ACTIVE before touching Redis", async () => {
  let createCalled = false;
  await assert.rejects(
    holdSeats(
      request,
      dependencies({
        getTripStatus: async () => "LOCKED",
        createHold: async () => {
          createCalled = true;
          throw new Error("must not create a hold");
        }
      })
    ),
    (error) => error.code === "TRIP_NOT_ACTIVE" && /LOCKED/.test(error.message)
  );
  assert.equal(createCalled, false);
});

test("hold creation rechecks trip state and discards a racing invalid hold", async () => {
  const statuses = ["ACTIVE", "DEPARTED"];
  let discarded = 0;

  await assert.rejects(
    holdSeats(
      request,
      dependencies({
        getTripStatus: async () => statuses.shift(),
        discardHold: async () => {
          discarded += 1;
          return true;
        }
      })
    ),
    (error) => error.code === "TRIP_NOT_ACTIVE" && /DEPARTED/.test(error.message)
  );

  assert.equal(discarded, 1);
  assert.deepEqual(statuses, []);
});

test("post-hold persistence failures also discard the new Redis hold", async () => {
  let reads = 0;
  let discarded = 0;

  await assert.rejects(
    holdSeats(
      request,
      dependencies({
        loadSeats: async () => {
          reads += 1;
          if (reads === 2) {
            throw new Error("database unavailable");
          }
          return availableSeats;
        },
        discardHold: async () => {
          discarded += 1;
          return true;
        }
      })
    ),
    /database unavailable/
  );

  assert.equal(discarded, 1);
});

test("an ACTIVE trip is checked on both sides of the atomic Redis write", async () => {
  let statusChecks = 0;
  const result = await holdSeats(
    request,
    dependencies({
      getTripStatus: async () => {
        statusChecks += 1;
        return "ACTIVE";
      }
    })
  );

  assert.equal(statusChecks, 2);
  assert.equal(result.tripId, "trip-1");
  assert.equal(result.seats[0].status, "HELD");
});
