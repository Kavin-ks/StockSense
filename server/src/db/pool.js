import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

// Return NUMERIC columns as JS numbers (quantities / costs fit comfortably).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// Return DATE columns as plain 'YYYY-MM-DD' strings (avoid timezone shifts).
pg.types.setTypeParser(1082, (v) => v);

let activeBackend = null;

async function initPool() {
  if (activeBackend) return activeBackend;

  // Try real PostgreSQL first
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10, connectionTimeoutMillis: 1500 });
  try {
    const client = await pool.connect();
    client.release();
    console.log('[Database] Connected to PostgreSQL server.');
    activeBackend = {
      type: 'pg',
      query: (text, params) => pool.query(text, params),
      connect: () => pool.connect(),
      end: () => pool.end(),
    };
    return activeBackend;
  } catch (_err) {
    await pool.end().catch(() => {});
    console.log('[Database] PostgreSQL connection failed. Falling back to embedded PGlite...');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = new PGlite(path.join(dataDir, 'stocksense.db'));

    const wrapResult = (res) => ({
      rows: res?.rows || [],
      fields: res?.fields || [],
      rowCount: res?.affectedRows ?? res?.rows?.length ?? 0,
    });

    let transactionLock = Promise.resolve();

    const pgliteQuery = async (text, params) => {
      if (!params || params.length === 0) {
        const res = await db.exec(text);
        const lastRes = Array.isArray(res) ? res[res.length - 1] : res;
        return wrapResult(lastRes);
      }
      const res = await db.query(text, params);
      return wrapResult(res);
    };

    activeBackend = {
      type: 'pglite',
      query: pgliteQuery,
      connect: async () => {
        return {
          query: pgliteQuery,
          release: () => {},
        };
      },
      end: async () => {
        await db.close().catch(() => {});
      },
      withTransaction: async (fn) => {
        let releaseLock;
        const lockPromise = new Promise((resolve) => { releaseLock = resolve; });
        const previousLock = transactionLock;
        transactionLock = (async () => {
          await previousLock;
          await lockPromise;
        })();

        try {
          await previousLock;
          return await db.transaction(async (tx) => {
            const client = {
              query: async (text, params) => {
                if (!params || params.length === 0) {
                  const res = await tx.exec(text);
                  const lastRes = Array.isArray(res) ? res[res.length - 1] : res;
                  return wrapResult(lastRes);
                }
                const res = await tx.query(text, params);
                return wrapResult(res);
              },
              release: () => {},
            };
            return await fn(client);
          });
        } finally {
          releaseLock();
        }
      },
    };
    return activeBackend;
  }
}

export const pool = {
  query: async (text, params) => {
    const backend = await initPool();
    return backend.query(text, params);
  },
  connect: async () => {
    const backend = await initPool();
    return backend.connect();
  },
  end: async () => {
    if (activeBackend) {
      await activeBackend.end();
    }
  },
};

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const backend = await initPool();
  if (backend.withTransaction) {
    return backend.withTransaction(fn);
  }
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
