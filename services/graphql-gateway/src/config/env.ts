export type GatewayConfig = {
  port: number;
  webOrigin: string;
  auth: {
    jwtSecret: string;
    jwtExpiresInSeconds: number;
  };
  grpc: {
    tripAddress: string;
    bookingAddress: string;
    seatInventoryAddress: string;
  };
};

const DEFAULT_HOST = "localhost";

function readPort(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const rawValue = env[key];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer port.`);
  }

  return parsed;
}

function readGrpcAddress(
  env: NodeJS.ProcessEnv,
  addressKey: string,
  portKey: string,
  fallbackPort: number
): string {
  if (env[addressKey]) {
    return env[addressKey];
  }

  const host = env.SERVICE_HOST ?? DEFAULT_HOST;
  const port = readPort(env, portKey, fallbackPort);
  return `${host}:${port}`;
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    port: readPort(env, "GRAPHQL_GATEWAY_PORT", 4000),
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
    auth: {
      jwtSecret: env.JWT_SECRET ?? "local_demo_jwt_secret_change_me",
      jwtExpiresInSeconds: readPort(env, "JWT_EXPIRES_IN_SECONDS", 28800)
    },
    grpc: {
      tripAddress: readGrpcAddress(env, "TRIP_SERVICE_GRPC_ADDRESS", "TRIP_SERVICE_PORT", 50051),
      bookingAddress: readGrpcAddress(env, "BOOKING_SERVICE_GRPC_ADDRESS", "BOOKING_SERVICE_PORT", 50052),
      seatInventoryAddress: readGrpcAddress(
        env,
        "SEAT_INVENTORY_SERVICE_GRPC_ADDRESS",
        "SEAT_INVENTORY_SERVICE_PORT",
        50053
      )
    }
  };
}
