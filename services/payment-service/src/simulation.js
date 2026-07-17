import { publishKafkaEvent } from "@bus/shared/events.js";

const PAYMENT_EVENTS_TOPIC = "payment-events";

export function createPaymentResult(body) {
  return {
    bookingId: body.bookingId || null,
    bookingCode: body.bookingCode,
    tripId: body.tripId || null,
    amount: Number(body.amount || 0),
    success: Boolean(body.success)
  };
}

export function processPaymentSimulation(
  body,
  { publishEvent = publishKafkaEvent, logger = console } = {}
) {
  const payment = createPaymentResult(body);
  const eventName = payment.success
    ? "payment.simulated_success"
    : "payment.simulated_failure";

  // Payment simulation is the business boundary; Kafka is an analytics
  // side effect. Start it after this synchronous result is decided and handle
  // rejection locally so broker availability cannot turn payment into HTTP 500.
  void Promise.resolve()
    .then(() => publishEvent(PAYMENT_EVENTS_TOPIC, eventName, payment))
    .catch((error) => {
      logger.error(
        `[payment-service] failed to publish ${eventName} analytics for ${payment.bookingCode}`,
        error
      );
    });

  return payment;
}
