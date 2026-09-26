/**
 * End-of-day email digest for users who enabled "Daily movement digest" in their profile.
 * Runs in-process on a timer; daily_digest_log guarantees at most one email per user per day.
 */
import { query } from '../../db/pool.js';
import { sendMail } from '../../utils/mailer.js';

const SEND_AFTER_HOUR = 18; // local server time
const CHECK_EVERY_MS = 15 * 60 * 1000;

async function daySummary() {
  const [{ rows: moves }, { rows: late }, { rows: low }] = await Promise.all([
    query(
      `SELECT count(DISTINCT m.reference) FILTER (WHERE fl.type <> 'internal' AND tl.type = 'internal')::int AS "inDocs",
              count(DISTINCT m.reference) FILTER (WHERE fl.type = 'internal' AND tl.type <> 'internal')::int AS "outDocs",
              COALESCE(sum(m.quantity) FILTER (WHERE fl.type <> 'internal' AND tl.type = 'internal'), 0) AS "inQty",
              COALESCE(sum(m.quantity) FILTER (WHERE fl.type = 'internal' AND tl.type <> 'internal'), 0) AS "outQty"
         FROM stock_moves m
         JOIN locations fl ON fl.id = m.from_location_id
         JOIN locations tl ON tl.id = m.to_location_id
        WHERE m.created_at >= CURRENT_DATE`,
    ),
    query(`SELECT count(*)::int AS n FROM operations WHERE status IN ('draft','waiting','ready') AND scheduled_date < CURRENT_DATE`),
    query(
      `SELECT count(*)::int AS n FROM (
         SELECT r.id FROM reorder_rules r
           JOIN products p ON p.id = r.product_id AND p.is_active
           LEFT JOIN locations l ON l.warehouse_id = r.warehouse_id AND l.type = 'internal'
           LEFT JOIN stock_quants q ON q.location_id = l.id AND q.product_id = r.product_id
          GROUP BY r.id, r.min_qty HAVING COALESCE(sum(q.quantity), 0) <= r.min_qty) x`,
    ),
  ]);
  return { ...moves[0], lateDocs: late[0].n, lowStock: low[0].n };
}

export async function sendDailyDigests(now = new Date()) {
  if (now.getHours() < SEND_AFTER_HOUR) return 0;
  const { rows: users } = await query(
    `SELECT u.id, u.name, u.email FROM users u JOIN user_preferences up ON up.user_id = u.id
      WHERE u.status = 'active' AND (up.prefs -> 'notifications' ->> 'dailyDigest')::boolean IS TRUE
        AND NOT EXISTS (SELECT 1 FROM daily_digest_log d WHERE d.user_id = u.id AND d.digest_date = CURRENT_DATE)`,
  );
  if (!users.length) return 0;
  const s = await daySummary();
  let sent = 0;
  for (const u of users) {
    // Claim today's slot first; a concurrent instance that loses the race sends nothing.
    const { rowCount } = await query(
      'INSERT INTO daily_digest_log (user_id, digest_date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING',
      [u.id],
    );
    if (!rowCount) continue;
    await sendMail({
      to: u.email,
      subject: `StockSense daily digest: ${s.inDocs} in, ${s.outDocs} out`,
      text: [
        `Hi ${u.name},`, '',
        `Today in StockSense:`,
        `  Received: ${s.inDocs} document(s), ${Number(s.inQty)} unit(s)`,
        `  Shipped / removed: ${s.outDocs} document(s), ${Number(s.outQty)} unit(s)`,
        `  Late open documents: ${s.lateDocs}`,
        `  Products at or below their reorder minimum: ${s.lowStock}`, '',
        'You can turn this email off in My Profile -> Alert triggers.',
      ].join('\n'),
    }).catch((err) => console.error('[digest] mail failed for user', u.id, err.message));
    sent += 1;
  }
  return sent;
}

let timer = null;
export function startDigestScheduler() {
  const tick = () => sendDailyDigests().catch((err) => console.error('[digest]', err.message));
  timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref();
  tick();
}
export const stopDigestScheduler = () => clearInterval(timer);
