import assert from "node:assert/strict";
import test from "node:test";

import { handleBookingLifecycleEvent } from "../src/consumers/bookingLifecycleHandler.js";

test("seat state event is published only after booking lifecycle release succeeds", async () => {
  const order = [];
  const event = {
    eventId: "event-1",
    eventName: "booking.expired",
    payload: {
      tripId: "trip-1",
      seatIds: ["seat-1"],
      holdToken: "hold-1"
    }
  };

  const outcome = await handleBookingLifecycleEvent(event, {
    processEvent: async () => {
      order.push("released");
      return { eventName: "booking.expired", released: true };
    },
    publish: async (eventName, payload, metadata) => {
      order.push("published");
      assert.equal(eventName, "seat.state_changed");
      assert.deepEqual(payload, {
        tripId: "trip-1",
        seatIds: ["seat-1"],
        sourceEventId: "event-1"
      });
      assert.deepEqual(metadata, { routingKey: "seat.state_changed" });
    }
  });

  assert.deepEqual(order, ["released", "published"]);
  assert.deepEqual(outcome, { eventName: "booking.expired", released: true });
});

test("failed release never publishes a seat state event", async () => {
  let published = false;

  await assert.rejects(
    handleBookingLifecycleEvent(
      {
        eventName: "booking.cancelled",
        payload: { tripId: "trip-1", seatIds: ["seat-1"] }
      },
      {
        processEvent: async () => {
          throw new Error("release failed");
        },
        publish: async () => {
          published = true;
        }
      }
    ),
    /release failed/
  );

  assert.equal(published, false);
});
