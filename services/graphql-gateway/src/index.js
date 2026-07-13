import "dotenv/config";
import { createServer } from "node:http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";

import { loadGatewayConfig } from "./config/env.js";
import { closeGrpcClients, createGrpcClients } from "./grpc/clients.js";
import { loadTypeDefs } from "./graphql/schema.js";
import { startRealtimeWorkflowBridge } from "./events/workflowBridge.js";
import { createContextFactory } from "./server/context.js";
import { createLoaders } from "./server/loaders.js";
import { resolvers } from "./server/resolvers.js";

async function main() {
  const config = loadGatewayConfig();
  const typeDefs = await loadTypeDefs();
  const grpcClients = createGrpcClients(config);

  if (config.workflowEventsEnabled) {
    await startRealtimeWorkflowBridge(grpcClients);
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  const httpServer = createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  const serverCleanup = useServer(
    {
      schema,
      context: () => {
        return {
          config,
          grpc: grpcClients,
          loaders: createLoaders(grpcClients)
        };
      }
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: createContextFactory(config, grpcClients)
    })
  );

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

  httpServer.listen(config.port, () => {
    console.log(`GraphQL Gateway ready at http://localhost:${config.port}/graphql`);
    console.log(`Subscriptions ready at ws://localhost:${config.port}/graphql`);
    console.log(`Trip Service gRPC target: ${config.grpc.tripAddress}`);
    console.log(`Booking Service gRPC target: ${config.grpc.bookingAddress}`);
    console.log(`Seat Inventory Service gRPC target: ${config.grpc.seatInventoryAddress}`);
  });
}

main().catch((error) => {
  console.error("GraphQL Gateway failed to start.");
  console.error(error);
  process.exit(1);
});
