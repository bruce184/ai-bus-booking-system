import assert from "node:assert/strict";
import test from "node:test";

import { processBookingLifecycleEvent } from "../src/consumers/bookingLifecycleProcessor.js";

test("booking.expired releases by hold token", async () => {
  let receivedToken = "";
  const outcome = await processBookingLifecycleEvent(
    { eventName: "booking.expired", payload: { holdToken: "hold-1" } },
    { releaseHoldToken: async (token) => { receivedToken = token; return true; } }
  );

  assert.equal(receivedToken, "hold-1");
  assert.deepEqual(outcome, { eventName: "booking.expired", released: true });
});

test("booking.cancelled releases only seats belonging to that booking", async () => {
  let request;
  const outcome = await processBookingLifecycleEvent(
    {
      eventName: "booking.cancelled",
      payload: { bookingId: "booking-1", tripId: "trip-1", seatIds: ["A01", "A02"] }
    },
    {
      releaseBooked: async (value) => {
        request = value;
        return { seats: [{ id: "A01" }, { id: "A02" }] };
      }
    }
  );

  assert.deepEqual(request, {
    booking_id: "booking-1",
    trip_id: "trip-1",
    seat_ids: ["A01", "A02"]
  });
  assert.deepEqual(outcome, { eventName: "booking.cancelled", released: true });
});

test("booking.cancelled rejects incomplete payloads before touching inventory", async () => {
  await assert.rejects(
    processBookingLifecycleEvent({
      eventName: "booking.cancelled",
      payload: { bookingId: "booking-1", tripId: "trip-1" }
    }),
    /bookingId, tripId and seatIds/
  );
});
