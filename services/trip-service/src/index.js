// Trip Service entrypoint: initialize optional dependencies, verify Postgres,
// start the gRPC server, and shut down cleanly.
import { config } from './config.js';
import { logger } from './logger.js';
import { assertConnection, closePool } from './db.js';
import { initCache, closeCache } from './cache.js';
import { initEvents, closeEvents } from './events.js';
import { startServer } from './server.js';

async function main() {
  logger.info('Starting Trip Service...');

  try {
    await assertConnection();
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.error('Cannot connect to PostgreSQL (required). Check DATABASE_URL and infra.', err.message);
    process.exit(1);
  }

  // Optional dependencies; the service runs without them.
  initCache();
  await initEvents();

  const server = await startServer();
  logger.info(`Trip Service ready on port ${config.port}`);

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    server.tryShutdown(async () => {
      await Promise.allSettled([closeCache(), closeEvents(), closePool()]);
      process.exit(0);
    });
    // Force-exit if graceful shutdown stalls.
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', err.stack || err.message);
  process.exit(1);
});
