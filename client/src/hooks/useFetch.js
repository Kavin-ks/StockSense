import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveRefresh } from './useLiveRefresh.js';

/**
 * Load data from an async function and re-run when `deps` change.
 * Ignores out-of-order responses so fast filter changes never show stale data.
 * `options.live` = topics that trigger a silent background refetch (other users' changes).
 */
export function useFetch(fn, deps = [], { live } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const callId = useRef(0);

  const run = useCallback(async () => {
    const id = ++callId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (id === callId.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, error, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);
  useLiveRefresh(live, run);
  return { ...state, reload: run };
}
