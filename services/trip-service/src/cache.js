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

export async function closeCache() {
  if (client) {
    await client.quit().catch(() => {});
  }
}
