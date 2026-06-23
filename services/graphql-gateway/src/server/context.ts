import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { verifyDemoJwt } from "../auth/jwt.js";
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
  return async ({ req }: { req: IncomingMessage }): Promise<GatewayContext> => {
    const authToken = readBearerToken(req.headers.authorization);

    return {
      requestId: randomUUID(),
      authToken,
      user: authToken ? verifyDemoJwt(authToken, config) : null,
      config,
      grpc
    };
  };
}
