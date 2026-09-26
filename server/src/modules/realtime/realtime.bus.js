/**
 * Live updates via PostgreSQL LISTEN/NOTIFY.
 *
 * Why Postgres instead of an in-memory emitter or a third-party service:
 *  - publish() runs on the caller's transaction client, and Postgres only delivers a
 *    NOTIFY when that transaction COMMITS. A rolled-back validation never tells
 *    clients that stock changed.
 *  - Every API instance LISTENs on the same channel, so it keeps working when the
 *    API is scaled horizontally, with no Redis or broker to run.
 */
import pg from 'pg';
import { EventEmitter } from 'node:events';
import { env } from '../../config/env.js';

const CHANNEL = 'stocksense_events';
export const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open browser tab

/** Queue an event; delivered to all instances when `db`'s transaction commits. */
export async function publish(db, topic, payload = {}, actor = null) {
  const event = { topic, ...payload, actorId: actor?.id ?? null, actorName: actor?.name ?? null, at: new Date().toISOString() };
  await db.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(event)]);
}

let client = null;
let stopped = false;

export async function startListener(attempt = 0) {
  stopped = false;
  client = new pg.Client({ connectionString: env.DATABASE_URL });
  client.on('notification', (msg) => {
    try { bus.emit('event', JSON.parse(msg.payload)); } catch { /* ignore malformed payloads */ }
  });
  // Reconnect with capped backoff if the database connection drops.
  client.on('error', (err) => {
    console.error('[realtime] listener error:', err.message);
    reconnect(attempt + 1);
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    if (attempt > 0) bus.emit('event', { topic: 'resync', at: new Date().toISOString() }); // clients refetch after a gap
  } catch (err) {
    console.error('[realtime] cannot listen:', err.message);
    reconnect(attempt + 1);
  }
}

function reconnect(attempt) {
  if (stopped) return;
  client?.removeAllListeners();
  client?.end().catch(() => {});
  setTimeout(() => startListener(attempt), Math.min(30_000, 1000 * 2 ** attempt));
}

export async function stopListener() {
  stopped = true;
  await client?.end().catch(() => {});
}
