// Loads configuration from the repo root .env (shared infra values) and the
// service-local .env (overrides), then exposes a typed config object.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(here, '..');
const repoRoot = path.resolve(serviceRoot, '..', '..');

// Root first (shared defaults), then service-local (wins on conflicts).
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(serviceRoot, '.env'), override: true });

export const config = {
  port: Number(process.env.TRIP_SERVICE_PORT || 50051),
  host: process.env.TRIP_SERVICE_HOST || '0.0.0.0',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking',
  redisUrl: process.env.REDIS_URL || '',
  searchCacheTtlSeconds: Number(process.env.TRIP_SEARCH_CACHE_TTL_SECONDS || 60),
  kafkaBrokers: (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean),
  kafkaSearchTopic: process.env.KAFKA_TOPIC_SEARCH_EVENTS || 'search-events',
  timezone: process.env.TRIP_DISPLAY_TIMEZONE || 'Asia/Ho_Chi_Minh',
  protoPath: path.join(repoRoot, 'proto', 'trip.proto'),
};
