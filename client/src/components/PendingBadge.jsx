import { userApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';

/** "N waiting" counter next to Settings → Users, kept live for managers. */
export function PendingBadge() {
  const { data } = useFetch(() => userApi.pendingCount(), [], { live: ['users'] });
  if (!data?.count) return null;
  return <span className="count-pill" title={`${data.count} sign-up(s) waiting for approval`}>{data.count}</span>;
}
