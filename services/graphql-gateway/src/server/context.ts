import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { GatewayConfig } from "../config/env.js";
import type { GatewayGrpcClients } from "../grpc/clients.js";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
};

export type GatewayContext = {
  requestId: string;
  authToken: string | null;
  user: CurrentUser | null;
  config: GatewayConfig;
  grpc: GatewayGrpcClients;
};

function readBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue?.startsWith("Bearer ")) {
    return null;
  }

  return headerValue.slice("Bearer ".length).trim() || null;
}

export function createContextFactory(config: GatewayConfig, grpc: GatewayGrpcClients) {
  return async ({ req }: { req: IncomingMessage }): Promise<GatewayContext> => ({
    requestId: randomUUID(),
    authToken: readBearerToken(req.headers.authorization),
    user: null,
    config,
    grpc
  });
}
