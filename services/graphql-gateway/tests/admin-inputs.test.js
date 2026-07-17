import assert from "node:assert/strict";
import test from "node:test";

import {
  mapRouteInput,
  mapStopInput,
  mapTripInput,
  mapVehicleInput,
  mapVehicleSeats
} from "../src/server/adminResolvers.js";

function assertValidationError(work, pattern) {
  assert.throws(
    work,
    (error) =>
      error.extensions?.code === "VALIDATION_ERROR"
      && pattern.test(error.message)
  );
}

test("admin gateway normalizes valid numeric inputs once", () => {
  assert.deepEqual(
    mapRouteInput({
      originLocationId: "origin",
      destinationLocationId: "destination",
      distanceKm: 300
    }),
    {
      id: "",
      originLocationId: "origin",
      destinationLocationId: "destination",
      distanceKm: 300
    }
  );
  assert.equal(
    mapStopInput({
      routeId: "route",
      locationId: "location",
      stopType: "PICKUP",
      stopOrder: 2
    }).stopOrder,
    2
  );
  assert.equal(
    mapVehicleInput({
      operatorName: "Demo",
      vehicleCode: "V01",
      vehicleType: "seat_29",
      seatCount: 29
    }).seatCount,
    29
  );
});

test("admin gateway rejects invalid route and seat topology before gRPC", () => {
  assertValidationError(
    () => mapRouteInput({
      originLocationId: "same",
      destinationLocationId: "same"
    }),
    /must be different/
  );
  assertValidationError(
    () => mapVehicleSeats([
      { label: "A01", deck: 1, row: 1, column: 1 },
      { label: "A02", deck: 1, row: 1, column: 1 }
    ]),
    /Duplicate seat coordinate/
  );
});

test("generic trip updates omit workflow status while creates default to DRAFT", () => {
  const input = {
    routeId: "route",
    vehicleId: "vehicle",
    departureTime: "2026-07-20T01:00:00.000Z",
    arrivalTime: "2026-07-20T03:00:00.000Z",
    price: 250000
  };
  assert.equal(mapTripInput(input).status, "DRAFT");
  assert.equal(
    mapTripInput(input, "trip").status,
    "TRIP_STATUS_UNSPECIFIED"
  );
  assertValidationError(
    () => mapTripInput({ ...input, status: "COMPLETED" }, "trip"),
    /adminUpdateTripStatus/
  );
});
