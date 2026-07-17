import { publishWorkflowEvent } from "@bus/shared/events.js";

import { processBookingLifecycleEvent } from "./bookingLifecycleProcessor.js";

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function seatIdsFromPayload(payload) {
  const values = payload.seatIds ?? payload.seat_ids;
  return Array.isArray(values)
    ? values.map(stringValue).filter(Boolean)
    : [];
}

export async function handleBookingLifecycleEvent(
  event,
  {
    processEvent = processBookingLifecycleEvent,
    publish = publishWorkflowEvent
  } = {}
) {
  const outcome = await processEvent(event);
  const payload = event.payload || {};
  const tripId = stringValue(payload.tripId ?? payload.trip_id);
  const seatIds = seatIdsFromPayload(payload);

  if (!tripId || seatIds.length === 0) {
    throw new Error(
      `${event.eventName} payload requires tripId and seatIds for realtime propagation`
    );
  }

  // Publish only after Seat Inventory has completed the idempotent release.
  // The Gateway then fetches the canonical map instead of trusting event state.
  await publish(
    "seat.state_changed",
    {
      tripId,
      seatIds,
      sourceEventId: event.eventId || ""
    },
    { routingKey: "seat.state_changed" }
  );

  return outcome;
}
