// Redis-backed search cache.
// Redis is optional for search/cache reads. Topology mutations that must
// coordinate with live seat holds use the same connection and fail closed.
import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';
import { failedPrecondition } from './errors.js';

const SEARCH_PREFIX = 'trip:search:';
const SEAT_MAINTENANCE_PREFIX = 'seat-maintenance:';
const SEAT_MAINTENANCE_TTL_MS = 120_000;

const RELEASE_SEAT_MAINTENANCE_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

const RENEW_SEAT_MAINTENANCE_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

export class SeatMaintenanceStoreError extends Error {}

export function seatMaintenanceKey(tripId) {
  return `${SEAT_MAINTENANCE_PREFIX}${tripId}`;
}

let client = null;
let enabled = false;

export function initCache() {
  if (!config.redisUrl) {
    logger.warn('REDIS_URL not set; trip search cache is disabled');
    return;
  }
  client = new Redis(config.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  client.on('ready', () => {
    enabled = true;
    logger.info('Redis cache connected');
  });
  client.on('error', (err) => {
    enabled = false;
    logger.warn('Redis unavailable; continuing without cache', err.message);
  });
  client.on('end', () => {
    enabled = false;
  });
}

function searchKey(params) {
  const hash = createHash('sha1').update(JSON.stringify(params)).digest('hex');
  return `${SEARCH_PREFIX}${hash}`;
}

export async function getCachedSearch(params) {
  if (!enabled || !client) return null;
  try {
    const raw = await client.get(searchKey(params));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('Cache read failed', err.message);
    return null;
  }
}

export async function setCachedSearch(params, value) {
  if (!enabled || !client) return;
  try {
    await client.set(
      searchKey(params),
      JSON.stringify(value),
      'EX',
      config.searchCacheTtlSeconds,
    );
  } catch (err) {
    logger.warn('Cache write failed', err.message);
  }
}

// Read-only visibility into Seat Inventory Service's Redis holds (documented
// `hold:{tripId}:{seatId}` key format, ARCHITECTURE.md section 8). Trip
// Service never writes these keys - same read-only cross-service precedent
// as Trip Service reading the analytics_daily search-count projection.
// Reuses the same optional connection as the search cache above: if Redis is
// down, availability just falls back to the DB-only count instead of erroring.
export async function getHeldSeatCount(tripId) {
  if (!enabled || !client) return 0;

  let cursor = '0';
  let count = 0;
  try {
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `hold:${tripId}:*`, 'COUNT', 100);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('Held-seat SCAN failed; showing DB-only availability', err.message);
    return 0;
  }

  return count;
}

async function hasActiveTripHolds(redisClient, tripId) {
  let cursor = '0';
  try {
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH',
        `hold:${tripId}:*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) return true;
    } while (cursor !== '0');
    return false;
  } catch (error) {
    throw new SeatMaintenanceStoreError(error.message);
  }
}

export async function withTripSeatMaintenanceClient(redisClient, tripId, work) {
  const key = seatMaintenanceKey(tripId);
  const token = randomUUID();
  let acquired;

  try {
    acquired = await redisClient.set(
      key,
      token,
      'PX',
      SEAT_MAINTENANCE_TTL_MS,
      'NX',
    );
  } catch (error) {
    throw new SeatMaintenanceStoreError(error.message);
  }

  if (acquired !== 'OK') {
    return { acquired: false, hasActiveHolds: false };
  }

  try {
    if (await hasActiveTripHolds(redisClient, tripId)) {
      return { acquired: true, hasActiveHolds: true };
    }

    return {
      acquired: true,
      hasActiveHolds: false,
      value: await work(async () => {
        let renewed;
        try {
          renewed = await redisClient.eval(
            RENEW_SEAT_MAINTENANCE_SCRIPT,
            1,
            key,
            token,
            SEAT_MAINTENANCE_TTL_MS,
          );
        } catch (error) {
          throw new SeatMaintenanceStoreError(error.message);
        }
        if (Number(renewed) !== 1) {
          throw new SeatMaintenanceStoreError('Seat-maintenance lease was lost');
        }
      }),
    };
  } finally {
    try {
      await redisClient.eval(RELEASE_SEAT_MAINTENANCE_SCRIPT, 1, key, token);
    } catch (error) {
      // The lock has a bounded TTL. Do not report a committed database update
      // as failed merely because best-effort lock cleanup could not reach Redis.
      logger.warn('Seat-maintenance lock cleanup failed', error.message);
    }
  }
}

export async function withTripSeatMaintenance(tripId, work) {
  if (!enabled || !client) {
    throw failedPrecondition(
      'SERVICE_TIMEOUT: Seat hold store unavailable; vehicle change was not applied',
    );
  }

  try {
    return await withTripSeatMaintenanceClient(client, tripId, work);
  } catch (error) {
    if (!(error instanceof SeatMaintenanceStoreError)) throw error;
    logger.warn('Seat-maintenance coordination failed', error.message);
    throw failedPrecondition(
      'SERVICE_TIMEOUT: Seat hold store unavailable; vehicle change was not applied',
    );
  }
}

export async function closeCache() {
  if (client) {
    await client.quit().catch(() => {});
  }
}
