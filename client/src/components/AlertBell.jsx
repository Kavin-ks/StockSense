import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { fmtQty } from '../utils.js';

/** Low-stock alerts (products at/below their reorder minimum). */
export function AlertBell() {
  const [open, setOpen] = useState(false);
  const { data: alerts = [] } = useFetch(() => dashboardApi.alerts(), [], { live: ['stock', 'products'] });
  const count = alerts?.length ?? 0;
  return (
    <div className="bell-wrap">
      <button className="icon-btn bell" aria-label={`${count} low stock alerts`} onClick={() => setOpen((o) => !o)}>
        🔔{count > 0 && <span className="bell-count">{count}</span>}
      </button>
      {open && (
        <div className="dropdown" onMouseLeave={() => setOpen(false)}>
          <strong>Low stock alerts</strong>
          {count === 0 && <p className="muted">All products are above their minimum.</p>}
          {alerts?.map((a) => (
            <Link key={`${a.id}-${a.warehouseName}`} to={`/products/${a.id}`} className="dropdown-item" onClick={() => setOpen(false)}>
              <span>[{a.sku}] {a.name}<small className="muted"> · {a.warehouseName}</small></span>
              <span className="text-danger">{fmtQty(a.onHand)} / min {fmtQty(a.minQty)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
