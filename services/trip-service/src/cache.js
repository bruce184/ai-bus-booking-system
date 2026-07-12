// Redis-backed search cache.
// Optional dependency: if Redis is unavailable the service still works, just
// without cache hits.
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

const SEARCH_PREFIX = 'trip:search:';

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

export async function closeCache() {
  if (client) {
    await client.quit().catch(() => {});
  }
}
