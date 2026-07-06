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
  const { rows } = await pool.query('select 1 as ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}
