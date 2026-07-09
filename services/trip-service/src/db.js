// PostgreSQL access. Postgres is the only hard dependency of this service.
import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected idle PostgreSQL client error', err.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function assertConnection() {
  const retries = 20;
  const delay = 1500;
  for (let i = 0; i < retries; i++) {
    try {
      const { rows } = await pool.query('select 1 as ok');
      if (rows[0]?.ok === 1) return true;
    } catch (err) {
      if (i === retries - 1) throw err;
      logger.info(`[PostgreSQL] Connection attempt ${i + 1}/${retries} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

export async function closePool() {
  await pool.end();
}
