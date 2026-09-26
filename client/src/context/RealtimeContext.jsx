import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { eventsApi } from '../api/endpoints.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

/**
 * One Server-Sent Events connection per tab. Pages subscribe to topics
 * ('operations', 'stock', 'products', ...) and refetch when something changes,
 * so every user sees other users' work without refreshing.
 *
 * EventSource cannot send an Authorization header, so we first exchange the
 * session for a 60-second stream token. After any disconnect we reconnect with a
 * fresh token and broadcast a 'resync' so pages refetch whatever they missed.
 */
const RealtimeContext = createContext({ status: 'offline', subscribe: () => () => {} });

const ANNOUNCE = { validated: 'validated', canceled: 'canceled', created: 'created', packed: 'packed' };
// Which "Alert triggers" toggle (My Profile) controls toasts for each document type.
const NOTIFY_KEY = { receipt: 'receipts', delivery: 'deliveries', adjustment: 'adjustments', internal: 'receipts' };

export function RealtimeProvider({ children }) {
  const { user, prefs, refresh, endSession } = useAuth();
  const notify = useToast();
  const [status, setStatus] = useState('offline');
  const listeners = useRef(new Set());
  const me = useRef(user);
  me.current = user;
  const notifyPrefs = useRef(prefs?.notifications);
  notifyPrefs.current = prefs?.notifications;

  const dispatch = useCallback((event) => {
    const self = me.current;
    if (event.topic === 'users' && event.action === 'signup' && self?.role === 'manager') {
      notify(`${event.name} signed up and is waiting for your approval`, 'info');
    }
    if (event.topic === 'users' && event.id === self?.id && event.actorId !== self?.id) {
      refresh();
      if (event.role && event.role !== self.role) notify(`Your role was changed to ${event.role === 'manager' ? 'Inventory Manager' : 'Warehouse Staff'}`, 'info');
    }
    const wanted = notifyPrefs.current?.[NOTIFY_KEY[event.type]] !== false;
    if (event.topic === 'operations' && event.actorId !== self?.id && wanted) {
      if (ANNOUNCE[event.action]) notify(`${event.actorName ?? 'Someone'} ${ANNOUNCE[event.action]} ${event.reference}`, 'info');
      if (event.action === 'stock-available') notify(`${event.reference} is ready: stock arrived`, 'info');
    }
    for (const fn of listeners.current) fn(event);
  }, [notify, refresh]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let source;
    let timer;
    let closed = false;
    let attempt = 0;

    const retry = () => {
      if (closed) return;
      attempt += 1;
      setStatus('offline');
      timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempt));
    };

    async function connect() {
      setStatus('connecting');
      let token;
      try {
        ({ token } = await eventsApi.token());
      } catch {
        return retry();
      }
      if (closed) return;
      source = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
      source.addEventListener('ready', () => {
        if (attempt > 0) dispatch({ topic: 'resync' });
        attempt = 0;
        setStatus('live');
      });
      source.addEventListener('revoked', (msg) => {
        closed = true;
        source.close();
        let message = 'You were signed out.';
        try { message = JSON.parse(msg.data).message ?? message; } catch { /* keep default */ }
        notify(message, 'error');
        endSession();
      });
      source.onmessage = (msg) => {
        try { dispatch(JSON.parse(msg.data)); } catch { /* ignore malformed event */ }
      };
      source.onerror = () => { source.close(); retry(); };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      source?.close();
      setStatus('offline');
    };
  }, [user?.id, dispatch, endSession, notify]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return <RealtimeContext.Provider value={{ status, subscribe }}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
