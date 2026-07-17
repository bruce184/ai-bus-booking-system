// Kafka producer for analytics search events.
// Optional dependency: search must never fail because Kafka is down, so all
// publish errors are swallowed with a warning.
import { randomUUID } from "node:crypto";
import { Kafka } from "kafkajs";
import { config } from "./config.js";
import { logger } from "./logger.js";

let producer = null;
let ready = false;

export async function initEvents() {
  if (!config.kafkaBrokers.length) {
    logger.warn(
      "KAFKA_BROKERS not set; trip.search_performed events are disabled",
    );
    return;
  }
  try {
    const kafka = new Kafka({
      clientId: "trip-service",
      brokers: config.kafkaBrokers,
      retry: { retries: 2 },
      logLevel: 1, // ERROR only
    });
    producer = kafka.producer();
    await producer.connect();
    ready = true;
    logger.info("Kafka producer connected");
  } catch (err) {
    ready = false;
    logger.warn(
      "Kafka unavailable; continuing without search events",
      err.message,
    );
  }
}

export async function publishSearchPerformed(payload) {
  if (!ready || !producer) return;
  try {
    await producer.send({
      topic: config.kafkaSearchTopic,
      messages: [
        {
          key: `${payload.origin}=>${payload.destination}`,
          value: JSON.stringify({
            eventId: randomUUID(),
            eventName: "trip.search_performed",
            payload: {
              origin: payload.origin,
              destination: payload.destination,
              departureDate: payload.departureDate,
              resultCount: payload.resultCount,
              cacheHit: payload.cacheHit,
            },
            occurredAt: new Date().toISOString(),
          }),
        },
      ],
    });
  } catch (err) {
    logger.warn("Failed to publish trip.search_performed", err.message);
  }
}

export async function closeEvents() {
  if (producer) {
    await producer.disconnect().catch(() => {});
  }
}
