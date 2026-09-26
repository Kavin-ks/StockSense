import pg from 'pg';
import { env } from '../config/env.js';

// Return NUMERIC columns as JS numbers (quantities / costs fit comfortably).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// Return DATE columns as plain 'YYYY-MM-DD' strings (avoid timezone shifts).
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const query = (text, params) => pool.query(text, params);

/**
 * Run `fn(client)` inside a single transaction.
 * Every stock-changing workflow goes through here so ledger + quants never diverge.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
