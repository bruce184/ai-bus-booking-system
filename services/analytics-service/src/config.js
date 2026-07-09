function optionalInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csv(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: optionalInteger(process.env.ANALYTICS_SERVICE_PORT, 50056),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking",
  kafkaBrokers: csv(process.env.KAFKA_BROKERS ?? "localhost:9092"),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "analytics-service",
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "analytics-service",
  topics: {
    search: process.env.KAFKA_TOPIC_SEARCH_EVENTS ?? "search-events",
    booking: process.env.KAFKA_TOPIC_BOOKING_EVENTS ?? "booking-events",
    payment: process.env.KAFKA_TOPIC_PAYMENT_EVENTS ?? "payment-events",
    checkin: process.env.KAFKA_TOPIC_CHECKIN_EVENTS ?? "checkin-events"
  }
};
