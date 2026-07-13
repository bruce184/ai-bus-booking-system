import { createWorkflowConsumer } from "@bus/shared/events.js";

import { completeCheckedInBookings } from "./tripCompletedProcessor.js";

const QUEUE_NAME = "booking-service.trip-completed";

export async function startTripCompletedConsumer(
  { consume = createWorkflowConsumer } = {}
) {
  return consume(QUEUE_NAME, ["trip.completed"], completeCheckedInBookings);
}
