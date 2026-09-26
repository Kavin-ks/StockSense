import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, signStreamToken, userFromToken } from '../../middleware/auth.js';
import { AppError } from '../../utils/AppError.js';
import { bus } from './realtime.bus.js';

const router = Router();
const HEARTBEAT_MS = 25_000; // keeps proxies from closing idle connections

// Step 1: exchange the session JWT (header) for a 60-second stream token.
router.post('/token', requireAuth, (req, res) => res.json({ token: signStreamToken(req.user) }));

/** Who may see an event. User-admin events only go to managers and to the affected user. */
function visibleTo(user, event) {
  if (event.topic === 'sessions') return false; // handled below, never forwarded
  if (event.topic !== 'users') return true;
  return user.role === 'manager' || event.id === user.id;
}

const REVOKE_REASONS = {
  deactivated: 'Your account was deactivated by a manager.',
  deleted: 'Your account was removed by a manager.',
  session: 'You were signed out from another device.',
};

// Step 2: Server-Sent Events stream.
router.get('/stream', asyncHandler(async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) throw AppError.unauthorized();
  const user = await userFromToken(token, 'events');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  res.write(`event: ready\ndata: {}\n\n`);

  const send = (event) => {
    const revoke = (reason) => {
      res.write(`event: revoked\ndata: ${JSON.stringify({ message: REVOKE_REASONS[reason] })}\n\n`);
      return res.end();
    };
    if (event.topic === 'sessions' && event.id === user.sessionId) return revoke('session');
    if (event.topic === 'users' && event.id === user.id) {
      if (event.status === 'deactivated' || event.status === 'deleted') return revoke(event.status);
      if (event.role) user.role = event.role; // keep the visibility check current
    }
    if (visibleTo(user, event)) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  bus.on('event', send);
  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('event', send);
  });
}));

export default router;
