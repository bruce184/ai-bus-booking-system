import { createWorkflowConsumer } from "@bus/shared/events.js";

import { callGrpc } from "../grpc/call.js";
import { publishBookingUpdated } from "../server/bookingUpdatedPubSub.js";
import { publishSeatStateChanged } from "../server/seatStatePubSub.js";

const QUEUE_NAME = "graphql-gateway.realtime";
const ROUTING_KEYS = [
  "booking.paid",
  "booking.expired",
  "booking.cancelled",
  "booking.completed",
  "ticket.issued",
  "seat.hold_expired",
  "seat.state_changed"
];
const BOOKING_EVENTS = new Set([
  "booking.paid",
  "booking.expired",
  "booking.cancelled",
  "booking.completed",
  "ticket.issued"
]);

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function seatIdsFromPayload(payload) {
  const values = payload.seatIds ?? payload.seat_ids;
  if (Array.isArray(values)) {
    return values.map(stringValue).filter(Boolean);
  }

  const seatId = stringValue(payload.seatId ?? payload.seat_id);
  return seatId ? [seatId] : [];
}

async function publishCanonicalSeats(
  payload,
  { grpc, grpcCall, publishSeats }
) {
  const tripId = stringValue(payload.tripId ?? payload.trip_id);
  const seatIds = seatIdsFromPayload(payload);
  if (!tripId || seatIds.length === 0) {
    return;
  }

  const response = await grpcCall(grpc.seatInventory, "getSeatMap", { tripId });
  const wanted = new Set(seatIds);
  const seats = (response.seats || []).filter((seat) => wanted.has(seat.id));
  if (seats.length > 0) {
    publishSeats(tripId, seats);
  }
}

export async function processRealtimeWorkflowEvent(
  event,
  {
    grpc,
    grpcCall = callGrpc,
    publishBooking = publishBookingUpdated,
    publishSeats = publishSeatStateChanged
  }
) {
  const payload = event.payload || {};

  if (BOOKING_EVENTS.has(event.eventName)) {
    const bookingCode = stringValue(payload.bookingCode ?? payload.booking_code);
    const contactEmail = stringValue(payload.contactEmail ?? payload.contact_email);
    if (!bookingCode || !contactEmail) {
      throw new Error(`${event.eventName} requires bookingCode and contactEmail`);
    }

    const booking = await grpcCall(grpc.booking, "getBookingStatus", {
      bookingCode,
      email: contactEmail
    });
    publishBooking(booking);

    if (event.eventName === "booking.paid") {
      await publishCanonicalSeats(payload, { grpc, grpcCall, publishSeats });
    }
    return;
  }

  if (event.eventName === "seat.hold_expired" || event.eventName === "seat.state_changed") {
    await publishCanonicalSeats(payload, { grpc, grpcCall, publishSeats });
    return;
  }

  throw new Error(`Unsupported realtime workflow event: ${event.eventName}`);
}

export async function startRealtimeWorkflowBridge(
  grpc,
  { consume = createWorkflowConsumer } = {}
) {
  await consume(QUEUE_NAME, ROUTING_KEYS, (event) =>
    processRealtimeWorkflowEvent(event, { grpc })
  );
}
