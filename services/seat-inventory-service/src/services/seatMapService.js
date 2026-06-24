import grpc from "@grpc/grpc-js";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { serviceError } from "../errors.js";
import {
  blockTripSeats,
  confirmTripSeats,
  listTripSeats,
  listTripSeatsByIds
} from "../repositories/seatRepository.js";
import {
  getHeldSeatIds,
  holdSeatsAtomically,
  holdTokenCoversSeats,
  releaseSeatHolds,
  releaseHoldByToken
} from "../redis/holdStore.js";

function getTripId(request) {
  return request.tripId ?? request.trip_id ?? "";
}

function getSeatIds(request) {
  return request.seatIds ?? request.seat_ids ?? [];
}

function getRequesterId(request) {
  return request.requesterId ?? request.requester_id ?? "guest";
}

function getHoldToken(request) {
  return request.holdToken ?? request.hold_token ?? "";
}

function getBookingId(request) {
  return request.bookingId ?? request.booking_id ?? "";
}

function getAdminUserId(request) {
  return request.adminUserId ?? request.admin_user_id ?? "";
}

function toSeatResponse(seat, heldSeatIds) {
  let status = seat.status;

  if (status === "HELD" && !heldSeatIds.has(seat.id)) {
    status = "AVAILABLE";
  }

  if ((status === "AVAILABLE" || status === "HELD") && heldSeatIds.has(seat.id)) {
    status = "HELD";
  }

  return {
    id: seat.id,
    label: seat.label,
    deck: seat.deck,
    row: seat.row,
    column: seat.column,
    status,
    ...(seat.blockReason ? { blockReason: seat.blockReason } : {})
  };
}

export async function getSeatMap(request) {
  const tripId = getTripId(request).trim();

  if (!tripId) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "trip_id is required");
  }

  const seats = await listTripSeats(tripId);

  if (seats.length === 0) {
    throw serviceError(grpc.status.NOT_FOUND, "No seats found for trip");
  }

  const heldSeatIds = await getHeldSeatIds(tripId, seats);

  return {
    seats: seats.map((seat) => toSeatResponse(seat, heldSeatIds))
  };
}

export async function holdSeats(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const requesterId = getRequesterId(request).trim() || "guest";

  if (!tripId) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "trip_id is required");
  }

  if (seatIds.length === 0) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "seat_ids must contain at least one seat");
  }

  const seats = await listTripSeatsByIds(tripId, seatIds);
  const foundSeatIds = new Set(seats.map((seat) => seat.id));
  const missingSeatId = seatIds.find((seatId) => !foundSeatIds.has(seatId));

  if (missingSeatId) {
    throw serviceError(grpc.status.NOT_FOUND, `Seat ${missingSeatId} was not found for trip`);
  }

  const blockedSeat = seats.find((seat) => seat.status === "BLOCKED" || seat.status === "BOOKED");

  if (blockedSeat) {
    throw serviceError(
      grpc.status.FAILED_PRECONDITION,
      `SEAT_NOT_AVAILABLE: Seat ${blockedSeat.id} is ${blockedSeat.status}`
    );
  }

  const holdToken = randomUUID();
  const holdResult = await holdSeatsAtomically(
    tripId,
    seatIds,
    requesterId,
    holdToken,
    config.seatHoldTtlSeconds
  );

  if (holdResult.conflictSeatId) {
    throw serviceError(
      grpc.status.FAILED_PRECONDITION,
      `SEAT_NOT_AVAILABLE: Seat ${holdResult.conflictSeatId} is already held`
    );
  }

  return {
    holdToken,
    tripId,
    seats: seats.map((seat) => ({
      ...toSeatResponse(seat, new Set(seatIds)),
      status: "HELD"
    })),
    expiresAt: holdResult.expiresAt
  };
}

export async function releaseHold(request) {
  const holdToken = getHoldToken(request).trim();

  if (!holdToken) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "hold_token is required");
  }

  return {
    released: await releaseHoldByToken(holdToken)
  };
}

export async function confirmSeats(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const holdToken = getHoldToken(request).trim();
  const bookingId = getBookingId(request).trim();

  if (!tripId) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "trip_id is required");
  }

  if (seatIds.length === 0) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "seat_ids must contain at least one seat");
  }

  if (!holdToken) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "hold_token is required");
  }

  if (!bookingId) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "booking_id is required");
  }

  const heldSeats = await holdTokenCoversSeats(tripId, seatIds, holdToken);

  if (!heldSeats.valid) {
    throw serviceError(
      grpc.status.FAILED_PRECONDITION,
      `HOLD_EXPIRED: Hold token does not cover seat ${heldSeats.missingSeatId ?? "unknown"}`
    );
  }

  const currentSeats = await listTripSeatsByIds(tripId, seatIds);
  const foundSeatIds = new Set(currentSeats.map((seat) => seat.id));
  const missingSeatId = seatIds.find((seatId) => !foundSeatIds.has(seatId));

  if (missingSeatId) {
    throw serviceError(grpc.status.NOT_FOUND, `Seat ${missingSeatId} was not found for trip`);
  }

  const unavailableSeat = currentSeats.find((seat) => seat.status === "BOOKED" || seat.status === "BLOCKED");

  if (unavailableSeat) {
    throw serviceError(
      grpc.status.FAILED_PRECONDITION,
      `SEAT_NOT_AVAILABLE: Seat ${unavailableSeat.id} is ${unavailableSeat.status}`
    );
  }

  const confirmedSeats = await confirmTripSeats(tripId, seatIds, bookingId);

  if (confirmedSeats.length !== seatIds.length) {
    throw serviceError(grpc.status.INTERNAL, "Failed to confirm all requested seats");
  }

  await releaseHoldByToken(holdToken);

  return {
    seats: confirmedSeats.map((seat) => ({
      ...toSeatResponse(seat, new Set()),
      status: "BOOKED"
    }))
  };
}

export async function blockSeats(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const reason = request.reason?.trim() || null;
  const adminUserId = getAdminUserId(request).trim();

  if (!tripId) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "trip_id is required");
  }

  if (seatIds.length === 0) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "seat_ids must contain at least one seat");
  }

  if (!adminUserId) {
    throw serviceError(grpc.status.INVALID_ARGUMENT, "admin_user_id is required");
  }

  const currentSeats = await listTripSeatsByIds(tripId, seatIds);
  const foundSeatIds = new Set(currentSeats.map((seat) => seat.id));
  const missingSeatId = seatIds.find((seatId) => !foundSeatIds.has(seatId));

  if (missingSeatId) {
    throw serviceError(grpc.status.NOT_FOUND, `Seat ${missingSeatId} was not found for trip`);
  }

  const bookedSeat = currentSeats.find((seat) => seat.status === "BOOKED");

  if (bookedSeat) {
    throw serviceError(
      grpc.status.FAILED_PRECONDITION,
      `SEAT_NOT_AVAILABLE: Seat ${bookedSeat.id} is BOOKED`
    );
  }

  const blockedSeats = await blockTripSeats(tripId, seatIds, reason);

  if (blockedSeats.length !== seatIds.length) {
    throw serviceError(grpc.status.INTERNAL, "Failed to block all requested seats");
  }

  await releaseSeatHolds(tripId, seatIds);

  return {
    seats: blockedSeats.map((seat) => ({
      ...toSeatResponse(seat, new Set()),
      status: "BLOCKED"
    }))
  };
}
