import assert from "node:assert/strict";
import test from "node:test";

import {
  processRealtimeWorkflowEvent,
  startRealtimeWorkflowBridge
} from "../src/events/workflowBridge.js";

test("booking workflow events refresh canonical booking state with code and email", async () => {
  const calls = [];
  const published = [];
  const grpc = { booking: {}, seatInventory: {} };

  await processRealtimeWorkflowEvent(
    {
      eventName: "ticket.issued",
      payload: {
        bookingCode: "BK1",
        contactEmail: "guest@example.com"
      }
    },
    {
      grpc,
      grpcCall: async (client, method, request) => {
        calls.push({ client, method, request });
        return { bookingCode: "BK1", status: "TICKET_ISSUED" };
      },
      publishBooking: (booking) => published.push(booking),
      publishSeats: () => assert.fail("ticket.issued must not fabricate seat changes")
    }
  );

  assert.equal(calls[0].client, grpc.booking);
  assert.equal(calls[0].method, "getBookingStatus");
  assert.deepEqual(calls[0].request, {
    bookingCode: "BK1",
    email: "guest@example.com"
  });
  assert.deepEqual(published, [{ bookingCode: "BK1", status: "TICKET_ISSUED" }]);
});

test("seat workflow events fetch and publish only canonical affected seats", async () => {
  const published = [];
  const grpc = { booking: {}, seatInventory: {} };

  await processRealtimeWorkflowEvent(
    {
      eventName: "seat.hold_expired",
      payload: { tripId: "trip-1", seatId: "seat-2" }
    },
    {
      grpc,
      grpcCall: async (client, method, request) => {
        assert.equal(client, grpc.seatInventory);
        assert.equal(method, "getSeatMap");
        assert.deepEqual(request, { tripId: "trip-1" });
        return {
          seats: [
            { id: "seat-1", status: "HELD" },
            { id: "seat-2", status: "AVAILABLE" }
          ]
        };
      },
      publishBooking: () => assert.fail("seat event must not publish booking data"),
      publishSeats: (tripId, seats) => published.push({ tripId, seats })
    }
  );

  assert.deepEqual(published, [{
    tripId: "trip-1",
    seats: [{ id: "seat-2", status: "AVAILABLE" }]
  }]);
});

test("booking.paid refreshes both canonical booking and booked seat state", async () => {
  const publishedBookings = [];
  const publishedSeats = [];
  const grpc = { booking: {}, seatInventory: {} };

  await processRealtimeWorkflowEvent(
    {
      eventName: "booking.paid",
      payload: {
        bookingCode: "BK1",
        contactEmail: "guest@example.com",
        tripId: "trip-1",
        seatIds: ["seat-1"]
      }
    },
    {
      grpc,
      grpcCall: async (client) => {
        if (client === grpc.booking) return { bookingCode: "BK1", status: "PAID" };
        return { seats: [{ id: "seat-1", status: "BOOKED" }] };
      },
      publishBooking: (booking) => publishedBookings.push(booking),
      publishSeats: (tripId, seats) => publishedSeats.push({ tripId, seats })
    }
  );

  assert.equal(publishedBookings[0].status, "PAID");
  assert.equal(publishedSeats[0].seats[0].status, "BOOKED");
});

test("bridge binds one durable consumer callback to all realtime routing keys", async () => {
  let registration;
  const grpc = {};
  await startRealtimeWorkflowBridge(grpc, {
    consume: async (queue, keys, handler) => {
      registration = { queue, keys, handler };
    }
  });

  assert.equal(registration.queue, "graphql-gateway.realtime");
  assert.ok(registration.keys.includes("seat.hold_expired"));
  assert.ok(registration.keys.includes("ticket.issued"));
  assert.equal(typeof registration.handler, "function");
});
