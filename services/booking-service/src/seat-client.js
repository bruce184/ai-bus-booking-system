import { fail, isServiceErrorCode } from "@bus/shared/errors.js";
import { correlationMetadata, createInsecureClient, grpc, loadProto } from "@bus/shared/grpc.js";
import { getCorrelationId } from "@bus/shared/correlation.js";

let seatClient;

const SEAT_INVENTORY_TIMEOUT_MS = 10_000;

export function seatInventoryAddress(env = process.env) {
  return (
    env.SEAT_INVENTORY_SERVICE_GRPC_ADDRESS ||
    env.SEAT_INVENTORY_GRPC_URL ||
    "localhost:50052"
  );
}

export function releaseHoldRequest({ holdToken }) {
  return {
    hold_token: holdToken
  };
}

export function validateHoldRequest({ tripId, seatIds, holdToken }) {
  return {
    trip_id: tripId,
    seat_ids: seatIds,
    hold_token: holdToken
  };
}

export function confirmSeatsRequest({ tripId, seatIds, holdToken, bookingId }) {
  return {
    trip_id: tripId,
    seat_ids: seatIds,
    hold_token: holdToken,
    booking_id: bookingId
  };
}

export function releaseBookedSeatsRequest({ tripId, seatIds, bookingId }) {
  return {
    trip_id: tripId,
    seat_ids: seatIds,
    booking_id: bookingId
  };
}

function client() {
  if (!seatClient) {
    const proto = loadProto("seat_inventory.proto");
    seatClient = createInsecureClient(
      proto.bus.seat.v1.SeatInventoryService,
      seatInventoryAddress()
    );
  }
  return seatClient;
}

function normalizeErrorCode(value) {
  if (isServiceErrorCode(value)) {
    return value;
  }

  return null;
}

function readMetadataErrorCode(error) {
  const values = error.metadata?.get?.("error-code") || [];

  for (const value of values) {
    const code = normalizeErrorCode(Buffer.isBuffer(value) ? value.toString("utf8") : value);

    if (code) {
      return code;
    }
  }

  return null;
}

function readPrefixedErrorCode(error) {
  const details = error.details || error.message || "";
  const [prefix] = details.split(":", 1);

  return normalizeErrorCode(prefix);
}

export function mapSeatInventoryErrorCode(error) {
  const explicitCode = readMetadataErrorCode(error) || readPrefixedErrorCode(error);

  if (explicitCode) {
    return explicitCode;
  }

  switch (error.code) {
    case grpc.status.INVALID_ARGUMENT:
      return "VALIDATION_ERROR";
    case grpc.status.NOT_FOUND:
      return "NOT_FOUND";
    case grpc.status.DEADLINE_EXCEEDED:
      return "SERVICE_TIMEOUT";
    default:
      return null;
  }
}

function mapSeatInventoryErrorMessage(error, code) {
  const details = error.details || error.message || "Seat Inventory Service call failed";
  const prefix = `${code}:`;

  return details.startsWith(prefix) ? details.slice(prefix.length).trim() : details;
}

async function callSeatInventory(method, request) {
  try {
    return await new Promise((resolve, reject) => {
      const callback = (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      };
      const options = { deadline: Date.now() + SEAT_INVENTORY_TIMEOUT_MS };

      if (getCorrelationId()) {
        client()[method](request, correlationMetadata(), options, callback);
      } else {
        client()[method](request, options, callback);
      }
    });
  } catch (error) {
    const code = mapSeatInventoryErrorCode(error);

    if (code) {
      fail(code, mapSeatInventoryErrorMessage(error, code));
    }

    throw error;
  }
}

export async function validateSeatHold({ tripId, seatIds, holdToken }) {
  if (process.env.SKIP_SEAT_CONFIRMATION === "true") {
    console.warn("[booking-service] SKIP_SEAT_CONFIRMATION=true, not validating hold with Seat Inventory Service");
    return { valid: true, tripId, seatIds };
  }

  return callSeatInventory("ValidateHold", validateHoldRequest({ tripId, seatIds, holdToken }));
}

export async function confirmSeats({ tripId, seatIds, holdToken, bookingId }) {
  if (process.env.SKIP_SEAT_CONFIRMATION === "true") {
    console.warn("[booking-service] SKIP_SEAT_CONFIRMATION=true, not calling Seat Inventory Service");
    return { seats: seatIds.map((seatId) => ({ id: seatId, label: seatId, status: "BOOKED" })) };
  }

  return callSeatInventory("ConfirmSeats", confirmSeatsRequest({ tripId, seatIds, holdToken, bookingId }));
}

export async function releaseSeatHold({ holdToken }) {
  return callSeatInventory("ReleaseHold", releaseHoldRequest({ holdToken }));
}

export async function releaseBookedSeats({ tripId, seatIds, bookingId }) {
  if (process.env.SKIP_SEAT_CONFIRMATION === "true") {
    console.warn("[booking-service] SKIP_SEAT_CONFIRMATION=true, not calling Seat Inventory Service");
    return { seats: seatIds.map((seatId) => ({ id: seatId, label: seatId, status: "AVAILABLE" })) };
  }

  return callSeatInventory("ReleaseBookedSeats", releaseBookedSeatsRequest({ tripId, seatIds, bookingId }));
}
