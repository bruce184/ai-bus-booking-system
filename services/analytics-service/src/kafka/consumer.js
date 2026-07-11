import { Kafka } from "kafkajs";
import { config } from "../config.js";
import { handleSearchEvent } from "./handlers/searchEventsHandler.js";
import { handleBookingEvent } from "./handlers/bookingEventsHandler.js";
import { handlePaymentEvent } from "./handlers/paymentEventsHandler.js";
import { handleCheckinEvent } from "./handlers/checkinEventsHandler.js";
import { parseAnalyticsEvent } from "./eventEnvelope.js";

const TOPIC_HANDLERS = {
  [config.topics.search]: handleSearchEvent,
  [config.topics.booking]: handleBookingEvent,
  [config.topics.payment]: handlePaymentEvent,
  [config.topics.checkin]: handleCheckinEvent
};

let consumer;

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
    eachMessage: async ({ topic, message }) => {
      if (!message.value) {
        return;
      }

      try {
        const { eventName, payload, occurredAt } = parseAnalyticsEvent(
          message.value.toString("utf8"),
          { allowLegacyFlat: topic === config.topics.search }
        );
        const handler = TOPIC_HANDLERS[topic];

        if (!handler) {
          console.warn(`[analytics-service] no handler registered for topic ${topic}`);
          return;
        }

        await handler({ eventName, payload, occurredAt });
      } catch (error) {
        console.error(`[analytics-service] failed to process message on topic ${topic}`, error);
      }
    }
  });

  console.log(`[analytics-service] consuming Kafka topics: ${topics.join(", ")}`);
}

export async function stopAnalyticsConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = undefined;
  }
}
