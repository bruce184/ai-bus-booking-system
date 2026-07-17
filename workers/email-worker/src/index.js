import { createWorkflowConsumer } from "@bus/shared/events.js";
import { startHealthServer } from "@bus/shared/health.js";
import { processEmailEvent } from "./processor.js";

await createWorkflowConsumer(
  "email-worker.notifications",
  ["booking.paid", "ticket.issued", "email.requested"],
  processEmailEvent
);
console.log("[email-worker] waiting for notification events");

const healthPort = Number(process.env.EMAIL_WORKER_HEALTH_PORT || 62055);
startHealthServer(healthPort, "email-worker");
console.log(`[email-worker] health check on port ${healthPort}`);
