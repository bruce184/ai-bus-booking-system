import { randomUUID } from "node:crypto";
import { verifyDemoJwt } from "../auth/jwt.js";

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
      requestId: randomUUID(),
      authToken,
      user: authToken ? verifyDemoJwt(authToken, config) : null,
      config,
      grpc
    };
  };
}
