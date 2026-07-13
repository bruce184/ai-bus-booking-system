import { createWorkflowConsumer } from "@bus/shared/events.js";

import { config } from "../config.js";
import { processBookingLifecycleEvent } from "./bookingLifecycleProcessor.js";

await createWorkflowConsumer(
  config.bookingExpiredQueue,
  ["booking.expired", "booking.cancelled"],
  async (event) => {
    const outcome = await processBookingLifecycleEvent(event);
    console.log(
      `[seat-inventory] ${outcome.eventName} processed: released=${outcome.released} eventId=${
        event.eventId || "legacy"
      }`
    );
  }
);

console.log(
  `Seat Inventory booking lifecycle consumer listening on ${config.bookingExpiredQueue}`
);
