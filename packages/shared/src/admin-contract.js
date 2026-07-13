export class AdminInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdminInputError";
  }
}

const MAX_INT_32 = 2_147_483_647;
const MAX_VEHICLE_SEATS = 200;
const MAX_SEAT_DECK = 2;
const MAX_SEAT_ROW = 20;
const MAX_SEAT_COLUMN = 10;
export const CREATE_TRIP_STATUSES = Object.freeze(["DRAFT", "ACTIVE"]);
export const TRIP_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(["ACTIVE", "CANCELLED"]),
  ACTIVE: Object.freeze(["LOCKED", "CANCELLED"]),
  LOCKED: Object.freeze(["ACTIVE", "DEPARTED", "CANCELLED"]),
  DEPARTED: Object.freeze(["COMPLETED"]),
  COMPLETED: Object.freeze([]),
  CANCELLED: Object.freeze([])
});

function fail(message) {
  throw new AdminInputError(message);
}

export function requiredText(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    fail(`${fieldName} is required.`);
  }
  return normalized;
}

export function positiveInteger(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : value;
  const parsed = Number(normalized);
  if (
    normalized === ""
    || !Number.isSafeInteger(parsed)
    || parsed < 1
    || parsed > MAX_INT_32
  ) {
    fail(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function boundedPositiveInteger(value, fieldName, maximum) {
  const parsed = positiveInteger(value, fieldName);
  if (parsed > maximum) {
    fail(`${fieldName} must be at most ${maximum}.`);
  }
  return parsed;
}

export function optionalPositiveInteger(value, fieldName) {
  if (
    value === undefined
    || value === null
    || (typeof value === "string" && value.trim() === "")
    || Number(value) === 0
  ) {
    return 0;
  }
  return positiveInteger(value, fieldName);
}

export function normalizeRouteInput(input) {
  const originLocationId = requiredText(
    input?.originLocationId,
    "originLocationId"
  );
  const destinationLocationId = requiredText(
    input?.destinationLocationId,
    "destinationLocationId"
  );
  if (originLocationId === destinationLocationId) {
    fail("Origin and destination must be different.");
  }
  return {
    originLocationId,
    destinationLocationId,
    distanceKm: optionalPositiveInteger(input?.distanceKm, "distanceKm")
  };
}

export function normalizeStopInput(input) {
  const stopType = requiredText(input?.stopType, "stopType");
  if (!["PICKUP", "DROPOFF"].includes(stopType)) {
    fail("stopType must be PICKUP or DROPOFF.");
  }
  return {
    routeId: requiredText(input?.routeId, "routeId"),
    locationId: requiredText(input?.locationId, "locationId"),
    stopType,
    stopOrder: positiveInteger(input?.stopOrder, "stopOrder")
  };
}

export function normalizeVehicleInput(input) {
  return {
    operatorName: requiredText(input?.operatorName, "operatorName"),
    vehicleCode: requiredText(input?.vehicleCode, "vehicleCode"),
    licensePlate: typeof input?.licensePlate === "string"
      ? input.licensePlate.trim()
      : "",
    vehicleType: requiredText(input?.vehicleType, "vehicleType"),
    seatCount: positiveInteger(input?.seatCount, "seatCount")
  };
}

export function normalizeVehicleSeatLayout(seats) {
  if (!Array.isArray(seats) || seats.length === 0) {
    fail("At least one vehicle seat is required.");
  }

  if (seats.length > MAX_VEHICLE_SEATS) {
    fail(`A vehicle layout may contain at most ${MAX_VEHICLE_SEATS} seats.`);
  }

  const labels = new Set();
  const coordinates = new Set();
  return seats.map((seat, index) => {
    const field = `seats[${index}]`;
    const normalized = {
      label: requiredText(seat?.label, `${field}.label`),
      deck: boundedPositiveInteger(
        seat?.deck,
        `${field}.deck`,
        MAX_SEAT_DECK
      ),
      row: boundedPositiveInteger(
        seat?.row,
        `${field}.row`,
        MAX_SEAT_ROW
      ),
      column: boundedPositiveInteger(
        seat?.column,
        `${field}.column`,
        MAX_SEAT_COLUMN
      )
    };
    const labelKey = normalized.label.toLocaleUpperCase("en-US");
    const coordinateKey =
      `${normalized.deck}:${normalized.row}:${normalized.column}`;
    if (labels.has(labelKey)) {
      fail(`Duplicate seat label: ${normalized.label}.`);
    }
    if (coordinates.has(coordinateKey)) {
      fail(
        `Duplicate seat coordinate: deck ${normalized.deck}, row ${normalized.row}, column ${normalized.column}.`
      );
    }
    labels.add(labelKey);
    coordinates.add(coordinateKey);
    return normalized;
  });
}

function validDateTime(value, fieldName) {
  const date = new Date(value);
  if (
    (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date))
    || Number.isNaN(date.getTime())
  ) {
    fail(`${fieldName} must be a valid date-time.`);
  }
  return date;
}

export function normalizeTripInput(input, { isUpdate = false } = {}) {
  const departure = validDateTime(input?.departureTime, "departureTime");
  const arrival = validDateTime(input?.arrivalTime, "arrivalTime");
  if (arrival.getTime() <= departure.getTime()) {
    fail("arrivalTime must be after departureTime.");
  }

  const requestedStatus = input?.status;
  if (isUpdate && requestedStatus !== undefined && requestedStatus !== null) {
    fail("Use adminUpdateTripStatus to change trip status.");
  }
  const status = requestedStatus ?? "DRAFT";
  if (!isUpdate && !CREATE_TRIP_STATUSES.includes(status)) {
    fail("A new trip status must be DRAFT or ACTIVE.");
  }

  return {
    routeId: requiredText(input?.routeId, "routeId"),
    vehicleId: requiredText(input?.vehicleId, "vehicleId"),
    departureTime: departure.toISOString(),
    arrivalTime: arrival.toISOString(),
    price: positiveInteger(input?.price, "price"),
    status: isUpdate ? undefined : status
  };
}

export function assertTripStatusTransition(currentStatus, nextStatus) {
  if (!Object.hasOwn(TRIP_STATUS_TRANSITIONS, currentStatus)) {
    fail(`Unknown current trip status: ${currentStatus}.`);
  }
  if (!Object.hasOwn(TRIP_STATUS_TRANSITIONS, nextStatus)) {
    fail(`Unknown next trip status: ${nextStatus}.`);
  }
  if (currentStatus === nextStatus) {
    return nextStatus;
  }
  if (!TRIP_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    fail(`Invalid trip status transition: ${currentStatus} -> ${nextStatus}.`);
  }
  return nextStatus;
}

export function nextTripStatuses(currentStatus) {
  return [...(TRIP_STATUS_TRANSITIONS[currentStatus] ?? [])];
}
