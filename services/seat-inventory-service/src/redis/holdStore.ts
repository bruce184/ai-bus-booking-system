import { Redis } from "ioredis";
import { config } from "../config.js";
import type { TripSeatRecord } from "../seatTypes.js";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2
    });
  }

  return redis;
}

export function holdKey(tripId: string, seatId: string): string {
  return `hold:${tripId}:${seatId}`;
}

type HoldSeatsResult = {
  holdToken: string;
  expiresAt: string;
};

function holdTokenKey(holdToken: string): string {
  return `hold-token:${holdToken}`;
}

const holdSeatsScript = `
  for i, key in ipairs(KEYS) do
    if redis.call("EXISTS", key) == 1 then
      return {0, ARGV[5 + i]}
    end
  end

  for i, key in ipairs(KEYS) do
    local payload = cjson.encode({
      holdToken = ARGV[2],
      expiresAt = ARGV[3],
      tripId = ARGV[4],
      requesterId = ARGV[5],
      seatId = ARGV[5 + i]
    })

    local ok = redis.call("SET", key, payload, "EX", tonumber(ARGV[1]), "NX")

    if not ok then
      return {0, ARGV[5 + i]}
    end
  end

  redis.call("SET", "hold-token:" .. ARGV[2], cjson.encode(KEYS), "EX", tonumber(ARGV[1]))

  return {1, ""}
`;

export async function getHeldSeatIds(
  tripId: string,
  seats: Pick<TripSeatRecord, "id">[]
): Promise<Set<string>> {
  if (seats.length === 0) {
    return new Set();
  }

  const client = getRedis();
  const keys = seats.map((seat) => holdKey(tripId, seat.id));
  const values: (string | null)[] = await client.mget(keys);
  const heldSeatIds = new Set<string>();

  values.forEach((value: string | null, index: number) => {
    if (value) {
      heldSeatIds.add(seats[index].id);
    }
  });

  return heldSeatIds;
}

export async function holdSeatsAtomically(
  tripId: string,
  seatIds: string[],
  requesterId: string,
  holdToken: string,
  ttlSeconds: number
): Promise<HoldSeatsResult & { conflictSeatId?: string }> {
  const client = getRedis();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const keys = seatIds.map((seatId) => holdKey(tripId, seatId));
  const result = (await client.eval(
    holdSeatsScript,
    keys.length,
    ...keys,
    String(ttlSeconds),
    holdToken,
    expiresAt,
    tripId,
    requesterId,
    ...seatIds
  )) as [number, string];

  if (Number(result[0]) !== 1) {
    return {
      holdToken,
      expiresAt,
      conflictSeatId: String(result[1] || "unknown")
    };
  }

  return {
    holdToken,
    expiresAt
  };
}

function parseHoldKeyList(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((key): key is string => typeof key === "string");
  } catch {
    return [];
  }
}

function holdPayloadMatchesToken(raw: string | null, holdToken: string): boolean {
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as { holdToken?: unknown };
    return parsed.holdToken === holdToken;
  } catch {
    return false;
  }
}

export async function holdTokenCoversSeats(
  tripId: string,
  seatIds: string[],
  holdToken: string
): Promise<{ valid: boolean; missingSeatId?: string }> {
  const client = getRedis();
  const keys = seatIds.map((seatId) => holdKey(tripId, seatId));
  const payloads = await client.mget(keys);

  for (const [index, payload] of payloads.entries()) {
    if (!holdPayloadMatchesToken(payload, holdToken)) {
      return {
        valid: false,
        missingSeatId: seatIds[index]
      };
    }
  }

  return {
    valid: true
  };
}

async function releaseIndexedHold(client: Redis, holdToken: string): Promise<number> {
  const tokenKey = holdTokenKey(holdToken);
  const indexedKeys = parseHoldKeyList(await client.get(tokenKey));

  if (indexedKeys.length === 0) {
    return 0;
  }

  const payloads = await client.mget(indexedKeys);
  const keysToDelete = indexedKeys.filter((key, index) =>
    holdPayloadMatchesToken(payloads[index], holdToken)
  );

  if (keysToDelete.length === 0) {
    await client.del(tokenKey);
    return 0;
  }

  return client.del(...keysToDelete, tokenKey);
}

async function releaseHoldByScan(client: Redis, holdToken: string): Promise<number> {
  let cursor = "0";
  let released = 0;

  do {
    const [nextCursor, keys] = await client.scan(cursor, "MATCH", "hold:*", "COUNT", 100);
    cursor = nextCursor;
    const holdKeys = keys.filter((key) => !key.startsWith("hold-token:"));

    if (holdKeys.length === 0) {
      continue;
    }

    const payloads = await client.mget(holdKeys);
    const keysToDelete = holdKeys.filter((key, index) =>
      holdPayloadMatchesToken(payloads[index], holdToken)
    );

    if (keysToDelete.length > 0) {
      released += await client.del(...keysToDelete);
    }
  } while (cursor !== "0");

  if (released > 0) {
    await client.del(holdTokenKey(holdToken));
  }

  return released;
}

export async function releaseHoldByToken(holdToken: string): Promise<boolean> {
  const client = getRedis();
  const indexedReleaseCount = await releaseIndexedHold(client, holdToken);

  if (indexedReleaseCount > 0) {
    return true;
  }

  return (await releaseHoldByScan(client, holdToken)) > 0;
}

export async function releaseSeatHolds(tripId: string, seatIds: string[]): Promise<number> {
  if (seatIds.length === 0) {
    return 0;
  }

  const client = getRedis();
  const keys = seatIds.map((seatId) => holdKey(tripId, seatId));
  const existingPayloads = await client.mget(keys);
  const tokenKeys = new Set<string>();

  existingPayloads.forEach((payload) => {
    if (!payload) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as { holdToken?: unknown };

      if (typeof parsed.holdToken === "string") {
        tokenKeys.add(holdTokenKey(parsed.holdToken));
      }
    } catch {
      // Ignore malformed demo payloads; deleting the seat hold key is enough.
    }
  });

  return client.del(...keys, ...tokenKeys);
}

export async function closeRedis(): Promise<void> {
  if (!redis) {
    return;
  }

  redis.disconnect();
  redis = null;
}
