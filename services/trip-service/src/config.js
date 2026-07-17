// Loads configuration from the repo root .env (shared infra values) and the
// service-local .env (overrides), then exposes a typed config object.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(here, '..');
const repoRoot = path.resolve(serviceRoot, '..', '..');

// Explicit process variables (including hermetic E2E ports) win. Service-local
// values fill next, then the root file supplies shared defaults.
dotenv.config({ path: path.join(serviceRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

export const config = {
  port: Number(process.env.TRIP_SERVICE_PORT || 50051),
  host: process.env.TRIP_SERVICE_HOST || '0.0.0.0',
  healthPort: Number(process.env.TRIP_SERVICE_HEALTH_PORT || 62051),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://bus_app:change_me_local_only@localhost:5432/bus_booking',
  redisUrl: process.env.REDIS_URL || '',
  analyticsBaseUrl: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:50056',
  searchCacheTtlSeconds: Number(process.env.TRIP_SEARCH_CACHE_TTL_SECONDS || 60),
  kafkaBrokers: (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean),
  kafkaSearchTopic: process.env.KAFKA_TOPIC_SEARCH_EVENTS || 'search-events',
  timezone: process.env.TRIP_DISPLAY_TIMEZONE || 'Asia/Ho_Chi_Minh',
  protoPath: path.join(repoRoot, 'proto', 'trip.proto'),
};
