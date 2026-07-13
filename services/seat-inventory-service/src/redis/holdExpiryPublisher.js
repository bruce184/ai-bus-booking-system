import { publishWorkflowEvent } from "@bus/shared/events.js";
import { Redis } from "ioredis";

import { config } from "../config.js";

const EXPIRED_EVENT_PATTERN = "__keyevent@*__:expired";

let expirySubscriber = null;

export function parseExpiredHoldKey(key) {
  const match = /^hold:([^:]+):([^:]+)$/.exec(String(key || ""));
  if (!match) {
    return null;
  }

  return {
    tripId: match[1],
    seatId: match[2]
  };
}

export function expirationNotificationFlags(currentFlags = "") {
  let flags = currentFlags;
  if (!flags.includes("E")) flags += "E";
  if (!flags.includes("x")) flags += "x";
  return flags;
}

export async function publishExpiredHold(
  key,
  { publish = publishWorkflowEvent } = {}
) {
  const hold = parseExpiredHoldKey(key);
  if (!hold) {
    return false;
  }

  await publish("seat.hold_expired", hold, {
    routingKey: "seat.hold_expired"
  });
  return true;
}

export async function startHoldExpiryPublisher(
  { client = null, publish = publishWorkflowEvent } = {}
) {
  if (!client && expirySubscriber) {
    return expirySubscriber;
  }

  const subscriber = client || new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });

  try {
    if (subscriber.status === "wait") {
      await subscriber.connect();
    }

    const response = await subscriber.config("GET", "notify-keyspace-events");
    const currentFlags = Array.isArray(response) ? String(response[1] || "") : "";
    const requiredFlags = expirationNotificationFlags(currentFlags);
    if (requiredFlags !== currentFlags) {
      await subscriber.config("SET", "notify-keyspace-events", requiredFlags);
    }

    subscriber.on("pmessage", (_pattern, _channel, key) => {
      void publishExpiredHold(key, { publish }).catch((error) => {
        console.error(
          `[seat-inventory] Failed to publish expired hold ${key}: ${error.message}`
        );
      });
    });
    await subscriber.psubscribe(EXPIRED_EVENT_PATTERN);
  } catch (error) {
    if (!client) {
      subscriber.disconnect();
    }
    throw error;
  }

  if (!client) {
    expirySubscriber = subscriber;
  }
  return subscriber;
}

export async function closeHoldExpiryPublisher() {
  if (!expirySubscriber) {
    return;
  }

  const subscriber = expirySubscriber;
  expirySubscriber = null;
  await subscriber.quit().catch(() => subscriber.disconnect());
}
