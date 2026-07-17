import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminInputError,
  assertTripStatusTransition,
  nextTripStatuses,
  normalizeRouteInput,
  normalizeStopInput,
  normalizeTripInput,
  normalizeVehicleInput,
  normalizeVehicleSeatLayout,
  optionalPositiveInteger,
  positiveInteger
} from "../src/admin-contract.js";

test("admin integer rules reject empty, fractional, negative, and oversized values", () => {
  assert.equal(positiveInteger("12", "count"), 12);
  assert.equal(optionalPositiveInteger("", "distance"), 0);
  assert.equal(optionalPositiveInteger(0, "distance"), 0);
  for (const value of ["", "1.5", "-1", "2147483648", Number.NaN]) {
    assert.throws(
      () => positiveInteger(value, "count"),
      (error) => error instanceof AdminInputError
    );
  }
});

test("route and stop inputs enforce domain invariants and trim text", () => {
  assert.deepEqual(
    normalizeRouteInput({
      originLocationId: " origin ",
      destinationLocationId: " destination ",
      distanceKm: "300"
    }),
    {
      originLocationId: "origin",
      destinationLocationId: "destination",
      distanceKm: 300
    }
  );
  assert.throws(
    () => normalizeRouteInput({
      originLocationId: "same",
      destinationLocationId: "same"
    }),
    /must be different/
  );
  assert.deepEqual(
    normalizeStopInput({
      routeId: "route",
      locationId: "location",
      stopType: "PICKUP",
      stopOrder: "2"
    }).stopOrder,
    2
  );
  assert.throws(
    () => normalizeStopInput({
      routeId: "route",
      locationId: "location",
      stopType: "WAIT",
      stopOrder: 1
    }),
    /PICKUP or DROPOFF/
  );
});

test("vehicle and seat layout rules reject ambiguous capacity", () => {
  assert.equal(
    normalizeVehicleInput({
      operatorName: " Demo ",
      vehicleCode: " V01 ",
      vehicleType: "seat_29",
      seatCount: "29"
    }).seatCount,
    29
  );
  assert.throws(
    () => normalizeVehicleInput({
      operatorName: "Demo",
      vehicleCode: "V01",
      vehicleType: "seat_29",
      seatCount: 0
    }),
    /positive integer/
  );

  const layout = normalizeVehicleSeatLayout([
    { label: " A01 ", deck: 1, row: 1, column: 1 }
  ]);
  assert.deepEqual(layout[0], {
    label: "A01",
    deck: 1,
    row: 1,
    column: 1
  });
  assert.throws(
    () => normalizeVehicleSeatLayout([
      { label: "A01", deck: 1, row: 1, column: 1 },
      { label: "a01", deck: 1, row: 1, column: 2 }
    ]),
    /Duplicate seat label/
  );
  assert.throws(
    () => normalizeVehicleSeatLayout([
      { label: "A01", deck: 1, row: 1, column: 1 },
      { label: "A02", deck: 1, row: 1, column: 1 }
    ]),
    /Duplicate seat coordinate/
  );
  assert.throws(
    () => normalizeVehicleSeatLayout([
      { label: "A01", deck: 3, row: 1, column: 1 }
    ]),
    /deck must be at most 2/
  );
});

test("trip input requires chronological times, positive price, and create-only status", () => {
  const input = {
    routeId: "route",
    vehicleId: "vehicle",
    departureTime: "2026-07-20T01:00:00.000Z",
    arrivalTime: "2026-07-20T03:00:00.000Z",
    price: "250000",
    status: "ACTIVE"
  };
  assert.deepEqual(normalizeTripInput(input), {
    routeId: "route",
    vehicleId: "vehicle",
    departureTime: input.departureTime,
    arrivalTime: input.arrivalTime,
    price: 250000,
    status: "ACTIVE"
  });
  assert.throws(
    () => normalizeTripInput({ ...input, arrivalTime: input.departureTime }),
    /after departureTime/
  );
  assert.throws(
    () => normalizeTripInput({ ...input, price: 0 }),
    /positive integer/
  );
  assert.throws(
    () => normalizeTripInput({ ...input, status: "DEPARTED" }),
    /DRAFT or ACTIVE/
  );
  assert.throws(
    () => normalizeTripInput(input, { isUpdate: true }),
    /adminUpdateTripStatus/
  );
});

test("trip status transitions are explicit, forward-only, and idempotent", () => {
  assert.equal(assertTripStatusTransition("DRAFT", "ACTIVE"), "ACTIVE");
  assert.equal(assertTripStatusTransition("LOCKED", "ACTIVE"), "ACTIVE");
  assert.equal(assertTripStatusTransition("DEPARTED", "COMPLETED"), "COMPLETED");
  assert.equal(assertTripStatusTransition("COMPLETED", "COMPLETED"), "COMPLETED");
  assert.deepEqual(nextTripStatuses("ACTIVE"), ["LOCKED", "CANCELLED"]);
  assert.throws(
    () => assertTripStatusTransition("ACTIVE", "COMPLETED"),
    /Invalid trip status transition/
  );
  assert.throws(
    () => assertTripStatusTransition("CANCELLED", "ACTIVE"),
    /Invalid trip status transition/
  );
});
