import { createWorkflowConsumer } from "@bus/shared/events.js";

import { issueTickets } from "./processor.js";

await createWorkflowConsumer("ticket-worker.booking-paid", ["booking.paid"], issueTickets);
console.log("[ticket-worker] waiting for booking.paid events");
