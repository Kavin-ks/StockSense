import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

// Return NUMERIC columns as JS numbers (quantities / costs fit comfortably).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// Return DATE columns as plain 'YYYY-MM-DD' strings (avoid timezone shifts).
pg.types.setTypeParser(1082, (v) => v);

let activeBackend = null;

async function getBackend() {
  if (activeBackend) return activeBackend;

  // 1. Try PostgreSQL server
  try {
    const pgPool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 2000,
    });
    const client = await pgPool.connect();
    client.release();
    console.log('[Database] Connected to PostgreSQL server.');
    activeBackend = {
      type: 'pg',
      query: (text, params) => pgPool.query(text, params),
      connect: () => pgPool.connect(),
      end: () => pgPool.end(),
      withTransaction: async (fn) => {
        const c = await pgPool.connect();
        try {
          await c.query('BEGIN');
          const res = await fn(c);
          await c.query('COMMIT');
          return res;
        } catch (err) {
          await c.query('ROLLBACK');
          throw err;
        } finally {
          c.release();
        }
      },
    };
    return activeBackend;
  } catch (err) {
    console.warn('[Database] PostgreSQL connection failed. Attempting PGlite fallback...', err.message);

    // Optional dynamic fallback for environments without PostgreSQL
    let PGlite;
    try {
      const pgliteModule = await import('@electric-sql/pglite');
      PGlite = pgliteModule.PGlite;
    } catch {
      throw new Error(
        `Failed to connect to PostgreSQL at ${env.DATABASE_URL}, and optional embedded @electric-sql/pglite is not installed. Please verify your PostgreSQL server is running.`
      );
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dataDir = path.resolve(__dirname, '../../data/stocksense.db');
    if (!fs.existsSync(path.dirname(dataDir))) {
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    }

    const db = new PGlite(dataDir);
    await db.waitReady;

    const wrapResult = (res) => ({
      rows: res?.rows || [],
      fields: res?.fields || [],
      rowCount: res?.affectedRows ?? res?.rows?.length ?? 0,
    });

    const runQuery = async (text, params) => {
      if (!params || params.length === 0) {
        const res = await db.exec(text);
        const last = Array.isArray(res) ? res[res.length - 1] : res;
        return wrapResult(last);
      }
      const res = await db.query(text, params);
      return wrapResult(res);
    };

    activeBackend = {
      type: 'pglite',
      query: runQuery,
      connect: async () => ({
        query: runQuery,
        release: () => {},
      }),
      end: async () => {
        await db.close().catch(() => {});
      },
      withTransaction: async (fn) => {
        return await db.transaction(async (tx) => {
          const client = {
            query: async (text, params) => {
              if (!params || params.length === 0) {
                const res = await tx.exec(text);
                const last = Array.isArray(res) ? res[res.length - 1] : res;
                return wrapResult(last);
              }
              const res = await tx.query(text, params);
              return wrapResult(res);
            },
            release: () => {},
          };
          return await fn(client);
        });
      },
    };
    return activeBackend;
  }
}

export const pool = {
  query: async (text, params) => {
    const b = await getBackend();
    return b.query(text, params);
  },
  connect: async () => {
    const b = await getBackend();
    return b.connect();
  },
  end: async () => {
    if (activeBackend) {
      await activeBackend.end();
      activeBackend = null;
    }
  },
};

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const b = await getBackend();
  return b.withTransaction(fn);
}
