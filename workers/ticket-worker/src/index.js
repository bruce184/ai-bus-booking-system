import { createWorkflowConsumer } from "@bus/shared/events.js";
import { dispatchOutboxEvents } from "@bus/shared/outbox.js";

import { issueTickets } from "./processor.js";

await createWorkflowConsumer("ticket-worker.booking-paid", ["booking.paid"], issueTickets);
console.log("[ticket-worker] waiting for booking.paid events");


async function runTicketOutboxDispatch() {
  try {
    await dispatchOutboxEvents({ aggregateTypes: ["ticket"] });
  } catch (error) {
    console.error("[ticket-worker] Outbox dispatch failed", error);
  }
}

const outboxTimer = setInterval(runTicketOutboxDispatch, 3000);
outboxTimer.unref();
