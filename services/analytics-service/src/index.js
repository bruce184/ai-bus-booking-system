import "dotenv/config";
import { config } from "./config.js";
import { closePostgres } from "./db/postgres.js";
import { createAnalyticsServer } from "./server.js";
import { startAnalyticsConsumer, stopAnalyticsConsumer } from "./kafka/consumer.js";

const server = createAnalyticsServer();

server.listen(config.port, () => {
  console.log(`[analytics-service] HTTP server listening on ${config.port}`);
});

startAnalyticsConsumer().catch((error) => {
  console.error("[analytics-service] Kafka consumer failed to start", error);
});

async function shutdown(signal) {
  console.log(`[analytics-service] ${signal} received, shutting down`);
  server.close();
  await stopAnalyticsConsumer();
  await closePostgres();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
