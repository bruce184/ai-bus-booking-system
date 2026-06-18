import amqp, { type Channel, type ConsumeMessage } from "amqplib";
import { config } from "../config.js";
import { releaseHoldByToken, releaseSeatHolds } from "../redis/holdStore.js";

type BookingExpiredPayload = {
  holdToken?: unknown;
  hold_token?: unknown;
  tripId?: unknown;
  trip_id?: unknown;
  seatIds?: unknown;
  seat_ids?: unknown;
};

function parseMessage(message: ConsumeMessage): BookingExpiredPayload {
  try {
    return JSON.parse(message.content.toString("utf8")) as BookingExpiredPayload;
  } catch {
    throw new Error("booking.expired payload must be valid JSON");
  }
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getSeatIds(payload: BookingExpiredPayload): string[] {
  const rawSeatIds = payload.seatIds ?? payload.seat_ids;

  if (!Array.isArray(rawSeatIds)) {
    return [];
  }

  return rawSeatIds
    .filter((seatId): seatId is string => typeof seatId === "string")
    .map((seatId) => seatId.trim())
    .filter(Boolean);
}

async function releaseExpiredBookingHold(payload: BookingExpiredPayload): Promise<boolean> {
  const holdToken = getString(payload.holdToken ?? payload.hold_token);

  if (holdToken) {
    return releaseHoldByToken(holdToken);
  }

  const tripId = getString(payload.tripId ?? payload.trip_id);
  const seatIds = getSeatIds(payload);

  if (tripId && seatIds.length > 0) {
    return (await releaseSeatHolds(tripId, seatIds)) > 0;
  }

  throw new Error("booking.expired payload requires holdToken or tripId + seatIds");
}

async function setupChannel(channel: Channel): Promise<void> {
  await channel.assertExchange(config.workflowExchange, "topic", { durable: true });
  await channel.assertQueue(config.bookingExpiredQueue, { durable: true });
  await channel.bindQueue(
    config.bookingExpiredQueue,
    config.workflowExchange,
    config.bookingExpiredRoutingKey
  );
}

export async function startBookingExpiredConsumer(): Promise<void> {
  const connection = await amqp.connect(config.rabbitmqUrl);
  const channel = await connection.createChannel();

  await setupChannel(channel);
  await channel.prefetch(10);

  await channel.consume(config.bookingExpiredQueue, async (message) => {
    if (!message) {
      return;
    }

    try {
      const payload = parseMessage(message);
      const released = await releaseExpiredBookingHold(payload);
      console.log(
        `booking.expired processed: released=${released} messageId=${
          message.properties.messageId ?? "n/a"
        }`
      );
      channel.ack(message);
    } catch (error) {
      console.error("booking.expired processing failed", error);
      channel.nack(message, false, false);
    }
  });

  console.log(
    `Seat Inventory booking.expired consumer listening on ${config.bookingExpiredQueue}`
  );

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    console.log(`Received ${signal}, shutting down booking.expired consumer`);
    await channel.close();
    await connection.close();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startBookingExpiredConsumer().catch((error) => {
  console.error("Failed to start booking.expired consumer", error);
  process.exit(1);
});
