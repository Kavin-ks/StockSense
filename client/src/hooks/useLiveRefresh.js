import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext.jsx';

/**
 * Call `onChange` (debounced) whenever a live event arrives for one of `topics`.
 * `filter(event)` can narrow it further, e.g. only this document's id.
 * A 'resync' (after reconnecting) always triggers, since events may have been missed.
 */
export function useLiveRefresh(topics, onChange, { filter, delay = 250 } = {}) {
  const { subscribe } = useRealtime();
  const latest = useRef({ onChange, filter });
  latest.current = { onChange, filter };
  const key = (topics ?? []).join(',');

  useEffect(() => {
    if (!key) return undefined;
    const wanted = new Set(key.split(','));
    let timer;
    const unsubscribe = subscribe((event) => {
      if (event.topic !== 'resync') {
        if (!wanted.has(event.topic)) return;
        if (latest.current.filter && !latest.current.filter(event)) return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => latest.current.onChange(event), delay);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [key, subscribe, delay]);
}
