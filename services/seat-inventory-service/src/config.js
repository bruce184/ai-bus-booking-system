import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
dotenv.config();

function readNumber(name, fallback) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be a valid integer`);
  }

  return parsed;
}

export const config = {
  grpcHost: process.env.SEAT_INVENTORY_SERVICE_HOST ?? "0.0.0.0",
  grpcPort: readNumber("SEAT_INVENTORY_SERVICE_PORT", 50053),
  seatHoldTtlSeconds: readNumber("SEAT_HOLD_TTL_SECONDS", 300),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
  workflowExchange: process.env.RABBITMQ_WORKFLOW_EXCHANGE ?? "bus.workflow",
  bookingExpiredQueue:
    process.env.RABBITMQ_BOOKING_EXPIRED_QUEUE ?? "seat-inventory.booking-expired",
  bookingExpiredRoutingKey: "booking.expired"
};
