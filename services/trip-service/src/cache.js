// Redis-backed search cache + popular-route counters.
// Optional dependency: if Redis is unavailable the service still works, just
// without cache hits and without live search-based popularity.
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

const SEARCH_PREFIX = 'trip:search:';
const POPULAR_KEY = 'trip:popular_routes';

let client = null;
let enabled = false;

export function initCache() {
  if (!config.redisUrl) {
    logger.warn('REDIS_URL not set; trip search cache and popularity are disabled');
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

// Increment the search counter for an origin/destination pair.
export async function incrementRouteSearch(origin, destination) {
  if (!enabled || !client) return;
  try {
    await client.zincrby(POPULAR_KEY, 1, `${origin}=>${destination}`);
  } catch (err) {
    logger.warn('Popular-route increment failed', err.message);
  }
}

// Returns [{ origin, destination, searchCount }] sorted by count desc, or null
// when Redis has no data so the caller can fall back to the database.
export async function getPopularRoutesFromCache(limit) {
  if (!enabled || !client) return null;
  try {
    const flat = await client.zrevrange(POPULAR_KEY, 0, limit - 1, 'WITHSCORES');
    if (!flat.length) return null;
    const result = [];
    for (let i = 0; i < flat.length; i += 2) {
      const [origin, destination] = flat[i].split('=>');
      result.push({ origin, destination, search_count: Number(flat[i + 1]) });
    }
    return result;
  } catch (err) {
    logger.warn('Popular-route read failed', err.message);
    return null;
  }
}

export async function closeCache() {
  if (client) {
    await client.quit().catch(() => {});
  }
}
