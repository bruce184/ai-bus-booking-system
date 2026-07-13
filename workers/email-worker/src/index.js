import { createWorkflowConsumer } from "@bus/shared/events.js";
import { processEmailEvent } from "./processor.js";

await createWorkflowConsumer(
  "email-worker.notifications",
  ["booking.paid", "ticket.issued", "email.requested"],
  processEmailEvent
);
console.log("[email-worker] waiting for notification events");
