import { Kafka } from "kafkajs";
import { config } from "../config.js";
import { handleSearchEvent } from "./handlers/searchEventsHandler.js";
import { handleBookingEvent } from "./handlers/bookingEventsHandler.js";
import { handlePaymentEvent } from "./handlers/paymentEventsHandler.js";
import { handleCheckinEvent } from "./handlers/checkinEventsHandler.js";
import { parseAnalyticsEvent } from "./eventEnvelope.js";
import { markEventProcessed } from "../repository/analyticsRepository.js";
import { transaction } from "../db/postgres.js";

const TOPIC_HANDLERS = {
  [config.topics.search]: handleSearchEvent,
  [config.topics.booking]: handleBookingEvent,
  [config.topics.payment]: handlePaymentEvent,
  [config.topics.checkin]: handleCheckinEvent
};

let consumer;

export async function processAnalyticsMessage(
  { topic, message },
  {
    handlers = TOPIC_HANDLERS,
    parseEvent = parseAnalyticsEvent,
    runTransaction = transaction,
    markProcessed = markEventProcessed,
    logger = console
  } = {}
) {
  if (!message.value) {
    return { status: "ignored", reason: "empty-message" };
  }

  let event;
  try {
    event = parseEvent(message.value.toString("utf8"), {
      allowLegacyFlat: topic === config.topics.search
    });
  } catch (error) {
    // A malformed envelope is deterministic: retrying the same Kafka record
    // cannot repair it. Resolve the handler so the partition can progress,
    // while keeping the rejection visible in the service log.
    logger.error(`[analytics-service] rejected malformed message on topic ${topic}`, error);
    return { status: "rejected", reason: "malformed-envelope" };
  }

  const handler = handlers[topic];
  if (!handler) {
    logger.warn(`[analytics-service] no handler registered for topic ${topic}`);
    return { status: "ignored", reason: "unknown-topic" };
  }

  const { eventId, eventName, payload, occurredAt } = event;

  try {
    let duplicate = false;
    await runTransaction(async (client) => {
      if (eventId && !(await markProcessed(client, eventId, topic))) {
        duplicate = true;
        return;
      }

      await handler({ eventName, payload, occurredAt, client });
    });

    if (duplicate) {
      logger.log(`[analytics-service] skipping duplicate event ${eventId} on ${topic}`);
      return { status: "ignored", reason: "duplicate-event" };
    }

    return { status: "processed" };
  } catch (error) {
    // Reject the eachMessage promise for transient processing failures. KafkaJS
    // must not auto-commit this offset; after the transaction rolls back, the
    // same canonical eventId makes the eventual retry idempotent.
    logger.error(`[analytics-service] failed to process message on topic ${topic}`, error);
    throw error;
  }
}

export async function startAnalyticsConsumer() {
  if (!config.kafkaBrokers.length) {
    console.warn("[analytics-service] KAFKA_BROKERS not set; Kafka consumer disabled");
    return;
  }

  const kafka = new Kafka({
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
    retry: { retries: 8 }
  });

  consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  await consumer.connect();

  const topics = Object.keys(TOPIC_HANDLERS);
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: processAnalyticsMessage
  });

  console.log(`[analytics-service] consuming Kafka topics: ${topics.join(", ")}`);
}

export async function stopAnalyticsConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = undefined;
  }
}
