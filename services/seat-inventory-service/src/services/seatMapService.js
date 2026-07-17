import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { fail } from "../errors.js";
import {
  blockTripSeats,
  confirmTripSeats,
  listTripSeats,
  listTripSeatsByIds,
  releaseBookedTripSeats
} from "../repositories/seatRepository.js";
import {
  getHeldSeatIds,
  holdSeatsAtomically,
  holdTokenCoversSeats,
  releaseSeatHolds,
  releaseHoldByToken,
  getHoldDetails
} from "../redis/holdStore.js";
import { fetchTripStatus } from "../trip-client.js";

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

export async function requireActiveTrip(tripId, getTripStatus = fetchTripStatus) {
  const status = await getTripStatus(tripId);
  if (status !== "ACTIVE") {
    fail("TRIP_NOT_ACTIVE", `Trip ${tripId} is ${status || "UNKNOWN"}`);
  }
  return status;
}

export async function getSeatMap(request) {
  const tripId = getTripId(request).trim();

  if (!tripId) {
    fail("VALIDATION_ERROR", "trip_id is required");
  }

  const seats = await listTripSeats(tripId);

  if (seats.length === 0) {
    fail("NOT_FOUND", "No seats found for trip");
  }

  const heldSeatIds = await getHeldSeatIds(tripId, seats);

  return {
    seats: seats.map((seat) => toSeatResponse(seat, heldSeatIds))
  };
}

export async function holdSeats(
  request,
  {
    getTripStatus = fetchTripStatus,
    loadSeats = listTripSeatsByIds,
    createHold = holdSeatsAtomically,
    discardHold = releaseHoldByToken
  } = {}
) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const requesterId = getRequesterId(request).trim() || "guest";

  if (!tripId) {
    fail("VALIDATION_ERROR", "trip_id is required");
  }

  if (seatIds.length === 0) {
    fail("VALIDATION_ERROR", "seat_ids must contain at least one seat");
  }

  await requireActiveTrip(tripId, getTripStatus);

  const seats = await loadSeats(tripId, seatIds);
  const foundSeatIds = new Set(seats.map((seat) => seat.id));
  const missingSeatId = seatIds.find((seatId) => !foundSeatIds.has(seatId));

  if (missingSeatId) {
    fail("NOT_FOUND", `Seat ${missingSeatId} was not found for trip`);
  }

  const blockedSeat = seats.find((seat) => seat.status === "BLOCKED" || seat.status === "BOOKED");

  if (blockedSeat) {
    fail("SEAT_NOT_AVAILABLE", `Seat ${blockedSeat.id} is ${blockedSeat.status}`);
  }

  const holdToken = randomUUID();
  const holdResult = await createHold(
    tripId,
    seatIds,
    requesterId,
    holdToken,
    config.seatHoldTtlSeconds
  );

  if (holdResult.maintenanceConflict) {
    fail("SEAT_NOT_AVAILABLE", "Trip seat sale is temporarily locked");
  }

  if (holdResult.conflictSeatId) {
    fail("SEAT_NOT_AVAILABLE", `Seat ${holdResult.conflictSeatId} is already held`);
  }

  try {
    // Close both races after the Redis write: persistent seat state and the
    // Trip Service sale state can change after their first snapshots.
    const refreshedSeats = await loadSeats(tripId, seatIds);
    const refreshedIds = new Set(refreshedSeats.map((seat) => seat.id));
    const disappearedSeatId = seatIds.find((seatId) => !refreshedIds.has(seatId));
    const persistentlyUnavailable = refreshedSeats.find(
      (seat) => seat.status === "BLOCKED" || seat.status === "BOOKED"
    );

    if (disappearedSeatId) {
      fail("NOT_FOUND", `Seat ${disappearedSeatId} was not found for trip`);
    }
    if (persistentlyUnavailable) {
      fail("SEAT_NOT_AVAILABLE", `Seat ${persistentlyUnavailable.id} is ${persistentlyUnavailable.status}`);
    }

    await requireActiveTrip(tripId, getTripStatus);

    return {
      holdToken,
      tripId,
      seats: refreshedSeats.map((seat) => ({
        ...toSeatResponse(seat, new Set(seatIds)),
        status: "HELD"
      })),
      expiresAt: holdResult.expiresAt
    };
  } catch (error) {
    try {
      await discardHold(holdToken);
    } catch {
      fail("SEAT_HOLD_ROLLBACK_FAILED", "Invalid hold will expire by Redis TTL");
    }
    throw error;
  }
}
export async function releaseHold(request) {
  const holdToken = getHoldToken(request).trim();

  if (!holdToken) {
    fail("VALIDATION_ERROR", "hold_token is required");
  }

  const details = await getHoldDetails(holdToken);
  const released = await releaseHoldByToken(holdToken);

  return {
    released,
    tripId: details?.tripId ?? "",
    seatIds: details?.seatIds ?? []
  };
}

export async function validateHold(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const holdToken = getHoldToken(request).trim();

  if (!tripId) {
    fail("VALIDATION_ERROR", "trip_id is required");
  }

  if (seatIds.length === 0) {
    fail("VALIDATION_ERROR", "seat_ids must contain at least one seat");
  }

  if (!holdToken) {
    fail("VALIDATION_ERROR", "hold_token is required");
  }

  const heldSeats = await holdTokenCoversSeats(tripId, seatIds, holdToken);

  if (!heldSeats.valid) {
    fail("HOLD_EXPIRED", `Hold token does not cover seat ${heldSeats.missingSeatId ?? "unknown"}`);
  }

  const currentSeats = await listTripSeatsByIds(tripId, seatIds);
  const foundSeatIds = new Set(currentSeats.map((seat) => seat.id));
  const missingSeatId = seatIds.find((seatId) => !foundSeatIds.has(seatId));

  if (missingSeatId) {
    fail("NOT_FOUND", `Seat ${missingSeatId} was not found for trip`);
  }

  const unavailableSeat = currentSeats.find((seat) => seat.status === "BOOKED" || seat.status === "BLOCKED");

  if (unavailableSeat) {
    fail("SEAT_NOT_AVAILABLE", `Seat ${unavailableSeat.id} is ${unavailableSeat.status}`);
  }

  return {
    valid: true,
    tripId,
    seatIds
  };
}

export async function confirmSeats(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const holdToken = getHoldToken(request).trim();
  const bookingId = getBookingId(request).trim();

  if (!tripId) {
    fail("VALIDATION_ERROR", "trip_id is required");
  }

  if (seatIds.length === 0) {
    fail("VALIDATION_ERROR", "seat_ids must contain at least one seat");
  }

  if (!holdToken) {
    fail("VALIDATION_ERROR", "hold_token is required");
  }

  if (!bookingId) {
    fail("VALIDATION_ERROR", "booking_id is required");
  }

  const confirmation = await confirmTripSeats(tripId, seatIds, bookingId, async () => {
    const heldSeats = await holdTokenCoversSeats(tripId, seatIds, holdToken);
    if (!heldSeats.valid) {
      fail("HOLD_EXPIRED", `Hold token does not cover seat ${heldSeats.missingSeatId ?? "unknown"}`);
    }
  });

  if (confirmation.outcome === "MISSING") {
    fail("NOT_FOUND", `Seat ${confirmation.seatId} was not found for trip`);
  }
  if (confirmation.outcome === "UNAVAILABLE") {
    fail("SEAT_NOT_AVAILABLE", `Seat ${confirmation.seatId} is ${confirmation.seatStatus}`);
  }

  if (!confirmation.alreadyConfirmed) {
    try {
      await releaseHoldByToken(holdToken);
    } catch (error) {
      // PostgreSQL BOOKED is authoritative after the transaction commits.
      // A stale Redis hold cannot override BOOKED and will expire by TTL.
      console.warn(`[seat-inventory] Failed to clean confirmed hold ${holdToken}: ${error.message}`);
    }
  }

  return {
    seats: confirmation.seats.map((seat) => ({
      ...toSeatResponse(seat, new Set()),
      status: "BOOKED"
    }))
  };
}

export async function releaseBookedSeats(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const bookingId = getBookingId(request).trim();

  if (!tripId) {
    fail("VALIDATION_ERROR", "trip_id is required");
  }

  if (seatIds.length === 0) {
    fail("VALIDATION_ERROR", "seat_ids must contain at least one seat");
  }

  if (!bookingId) {
    fail("VALIDATION_ERROR", "booking_id is required");
  }

  // Only seats still BOOKED by this booking are released; anything else
  // (already released, re-blocked by admin) is skipped rather than forced.
  const releasedSeats = await releaseBookedTripSeats(tripId, seatIds, bookingId);

  return {
    seats: releasedSeats.map((seat) => toSeatResponse(seat, new Set()))
  };
}

export async function blockSeats(request) {
  const tripId = getTripId(request).trim();
  const seatIds = [...new Set(getSeatIds(request).map((seatId) => seatId.trim()).filter(Boolean))];
  const reason = request.reason?.trim() || null;
  const adminUserId = getAdminUserId(request).trim();

  if (!tripId) {
    fail("VALIDATION_ERROR", "trip_id is required");
  }

  if (seatIds.length === 0) {
    fail("VALIDATION_ERROR", "seat_ids must contain at least one seat");
  }

  if (!adminUserId) {
    fail("VALIDATION_ERROR", "admin_user_id is required");
  }

  const blocking = await blockTripSeats(tripId, seatIds, reason);
  if (blocking.outcome === "MISSING") {
    fail("NOT_FOUND", `Seat ${blocking.seatId} was not found for trip`);
  }
  if (blocking.outcome === "UNAVAILABLE") {
    fail("SEAT_NOT_AVAILABLE", `Seat ${blocking.seatId} is ${blocking.seatStatus}`);
  }

  try {
    await releaseSeatHolds(tripId, seatIds);
  } catch (error) {
    // PostgreSQL BLOCKED is authoritative; stale hold keys are ignored by
    // GetSeatMap for BLOCKED seats and expire automatically.
    console.warn(`[seat-inventory] Failed to clean holds for blocked trip ${tripId}: ${error.message}`);
  }

  return {
    seats: blocking.seats.map((seat) => ({
      ...toSeatResponse(seat, new Set()),
      status: "BLOCKED"
    }))
  };
}
