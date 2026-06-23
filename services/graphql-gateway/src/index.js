import "dotenv/config";

import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

import { loadGatewayConfig } from "./config/env.js";
import { closeGrpcClients, createGrpcClients } from "./grpc/clients.js";
import { loadTypeDefs } from "./graphql/schema.js";
import { createContextFactory } from "./server/context.js";
import { resolvers } from "./server/resolvers.js";

async function main() {
  const config = loadGatewayConfig();
  const typeDefs = await loadTypeDefs();
  const grpcClients = createGrpcClients(config);

  const server = new ApolloServer({
    typeDefs,
    resolvers
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: config.port },
    context: createContextFactory(config, grpcClients)
  });

  const shutdown = async () => {
    await server.stop();
    closeGrpcClients(grpcClients);
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  console.log(`GraphQL Gateway ready at ${url}`);
  console.log(`Trip Service gRPC target: ${config.grpc.tripAddress}`);
  console.log(`Booking Service gRPC target: ${config.grpc.bookingAddress}`);
  console.log(`Seat Inventory Service gRPC target: ${config.grpc.seatInventoryAddress}`);
}

main().catch((error) => {
  console.error("GraphQL Gateway failed to start.");
  console.error(error);
  process.exit(1);
});
