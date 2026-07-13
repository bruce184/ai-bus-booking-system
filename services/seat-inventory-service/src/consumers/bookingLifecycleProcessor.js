import { releaseHoldByToken, releaseSeatHolds } from "../redis/holdStore.js";
import { releaseBookedSeats } from "../services/seatMapService.js";

function getString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getSeatIds(payload) {
  const rawSeatIds = payload.seatIds ?? payload.seat_ids;
  if (!Array.isArray(rawSeatIds)) {
    return [];
  }
  return rawSeatIds
    .filter((seatId) => typeof seatId === "string")
    .map((seatId) => seatId.trim())
    .filter(Boolean);
}

export async function processBookingLifecycleEvent(
  event,
  {
    releaseHoldToken = releaseHoldByToken,
    releaseHolds = releaseSeatHolds,
    releaseBooked = releaseBookedSeats
  } = {}
) {
  const payload = event.payload || {};
  const tripId = getString(payload.tripId ?? payload.trip_id);
  const seatIds = getSeatIds(payload);

  if (event.eventName === "booking.expired") {
    const holdToken = getString(payload.holdToken ?? payload.hold_token);
    if (holdToken) {
      return { eventName: event.eventName, released: await releaseHoldToken(holdToken) };
    }
    if (tripId && seatIds.length > 0) {
      return {
        eventName: event.eventName,
        released: (await releaseHolds(tripId, seatIds)) > 0
      };
    }
    throw new Error("booking.expired payload requires holdToken or tripId + seatIds");
  }

  if (event.eventName === "booking.cancelled") {
    const bookingId = getString(payload.bookingId ?? payload.booking_id);
    if (!tripId || seatIds.length === 0 || !bookingId) {
      throw new Error("booking.cancelled payload requires bookingId, tripId and seatIds");
    }
    const result = await releaseBooked({
      booking_id: bookingId,
      trip_id: tripId,
      seat_ids: seatIds
    });
    return { eventName: event.eventName, released: result.seats.length > 0 };
  }

  throw new Error(`Unsupported Seat Inventory workflow event: ${event.eventName}`);
}
