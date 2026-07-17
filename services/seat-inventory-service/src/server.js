import grpc from "@grpc/grpc-js";
import { startHealthServer } from "@bus/shared/health.js";
import { config } from "./config.js";
import { closePostgres } from "./db/postgres.js";
import { seatInventoryHandlers } from "./grpc/seatInventoryHandlers.js";
import { seatInventoryServiceDefinition } from "./grpc/proto.js";
import { closeRedis } from "./redis/holdStore.js";
import { closeTripClient } from "./trip-client.js";
import {
  closeHoldExpiryPublisher,
  startHoldExpiryPublisher
} from "./redis/holdExpiryPublisher.js";

try {
  await startHoldExpiryPublisher();
} catch (error) {
  console.error("Failed to start Redis hold-expiry publisher", error);
  process.exit(1);
}

const server = new grpc.Server();

server.addService(seatInventoryServiceDefinition, seatInventoryHandlers);

const address = `${config.grpcHost}:${config.grpcPort}`;

server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error, port) => {
  if (error) {
    console.error("Failed to start Seat Inventory Service", error);
    process.exit(1);
  }

  console.log(`Seat Inventory Service listening on ${address} (bound port ${port})`);
});

const healthServer = startHealthServer(config.healthPort, "seat-inventory-service");
console.log(`Seat Inventory Service health check on port ${config.healthPort}`);

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down Seat Inventory Service`);
  server.tryShutdown(async (error) => {
    if (error) {
      console.error("Graceful shutdown failed", error);
      server.forceShutdown();
      process.exit(1);
    }

    healthServer.close();
    await Promise.all([
      closePostgres(),
      closeRedis(),
      closeHoldExpiryPublisher(),
      closeTripClient()
    ]);
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
