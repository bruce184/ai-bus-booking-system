import assert from "node:assert/strict";
import test from "node:test";

import { processEmailEvent } from "../src/processor.js";

const event = {
  eventId: "event-1",
  eventName: "ticket.issued",
  payload: {
    bookingId: "booking-1",
    bookingCode: "BK202607130001",
    contactEmail: "guest@example.com",
    ticketCount: 1
  }
};

const runQuery = async () => ({
  rows: [{
    booking_code: "BK202607130001",
    contact_email: "guest@example.com",
    total_amount: 250000,
    status: "TICKET_ISSUED",
    ticket_count: 1
  }]
});

test("duplicate delivery is claimed before simulated email logging", async () => {
  const logs = [];
  const outcome = await processEmailEvent(event, {
    runQuery,
    runTransaction: (work) => work({}),
    claimEvent: async () => false,
    logger: { log: (...args) => logs.push(args) }
  });

  assert.deepEqual(outcome, { skipped: true });
  assert.equal(logs.length, 0);
});

test("first delivery logs one normalized email summary", async () => {
  const logs = [];
  const claims = [];
  const outcome = await processEmailEvent(event, {
    runQuery,
    runTransaction: (work) => work({}),
    claimEvent: async (_client, consumerName, eventId) => {
      claims.push({ consumerName, eventId });
      return true;
    },
    logger: { log: (...args) => logs.push(args) }
  });

  assert.equal(outcome.skipped, false);
  assert.deepEqual(claims, [{ consumerName: "email-worker.notifications", eventId: "event-1" }]);
  assert.equal(logs.length, 1);
  assert.deepEqual(outcome.message, {
    event: "ticket.issued",
    to: "guest@example.com",
    bookingCode: "BK202607130001",
    status: "TICKET_ISSUED",
    ticketCount: 1,
    totalAmount: 250000
  });
});
