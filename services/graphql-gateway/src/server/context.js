import { randomUUID } from "node:crypto";
import { getCorrelationId } from "@bus/shared/correlation.js";
import { verifyDemoJwt } from "../auth/jwt.js";
import { createLoaders } from "./loaders.js";

function readBearerToken(headerValue) {
  if (!headerValue?.startsWith("Bearer ")) {
    return null;
  }

  return headerValue.slice("Bearer ".length).trim() || null;
}

export function createContextFactory(config, grpc) {
  return async ({ req }) => {
    const authToken = readBearerToken(req.headers.authorization);

    return {
      requestId: getCorrelationId() || randomUUID(),
      authToken,
      user: authToken ? verifyDemoJwt(authToken, config) : null,
      config,
      grpc,
      loaders: createLoaders(grpc)
    };
  };
}
