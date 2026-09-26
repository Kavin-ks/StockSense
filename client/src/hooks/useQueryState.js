import { useSearchParams } from 'react-router-dom';

/**
 * Keep list filters in the URL (?status=ready&page=2) so they survive refresh
 * and can be shared. Changing any filter other than `page` resets to page 1.
 */
export function useQueryState(defaults = {}) {
  const [params, setParams] = useSearchParams();
  const state = { ...defaults, ...Object.fromEntries(params.entries()) };
  const update = (patch) => {
    const next = { ...state, ...patch };
    if (!('page' in patch)) delete next.page;
    const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== '' && v != null && v !== defaults[k]));
    setParams(clean, { replace: true });
  };
  return [state, update];
}
