import { useRealtime } from '../context/RealtimeContext.jsx';

const LABEL = { live: 'Live', connecting: 'Connecting…', offline: 'Offline, retrying' };

/** Shows whether this tab is receiving other users' changes in real time. */
export function LiveIndicator() {
  const { status } = useRealtime();
  return (
    <span className={`live-indicator live-${status}`} role="status" title={status === 'live' ? 'Changes by other users appear instantly' : LABEL[status]}>
      <span className="live-dot" aria-hidden /> {LABEL[status]}
    </span>
  );
}
