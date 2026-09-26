import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { dashboardApi } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { fmtQty } from '../utils.js';

const READ_ALERTS_KEY = 'stocksense_read_alerts';

function getInitialReadAlerts() {
  try {
    return JSON.parse(localStorage.getItem(READ_ALERTS_KEY)) || [];
  } catch {
    return [];
  }
}

/** Low-stock alerts (products at/below their reorder minimum). */
export function AlertBell() {
  const [open, setOpen] = useState(false);
  const [readAlerts, setReadAlerts] = useState(getInitialReadAlerts);
  const dropdownRef = useRef(null);

  const { data: rawAlerts = [] } = useFetch(() => dashboardApi.alerts(), []);

  // Filter out any notification that has already been clicked / marked as read
  const activeAlerts = (rawAlerts || []).filter((a) => {
    const key = `${a.id}-${a.warehouseName}`;
    return !readAlerts.includes(key);
  });

  const count = activeAlerts.length;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // When clicking an alert: mark it as read (removed) and close dropdown
  const handleAlertClick = (key) => {
    const next = [...readAlerts, key];
    setReadAlerts(next);
    try {
      localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(next));
    } catch {}
    setOpen(false);
  };

  // Dismiss a single alert directly
  const handleDismiss = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const next = [...readAlerts, key];
    setReadAlerts(next);
    try {
      localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(next));
    } catch {}
  };

  // Mark all unread alerts as read
  const handleClearAll = (e) => {
    e.stopPropagation();
    const allKeys = (rawAlerts || []).map((a) => `${a.id}-${a.warehouseName}`);
    const combined = Array.from(new Set([...readAlerts, ...allKeys]));
    setReadAlerts(combined);
    try {
      localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(combined));
    } catch {}
  };

  return (
    <div className="bell-wrap" ref={dropdownRef}>
      <button
        type="button"
        className="icon-btn bell"
        aria-label={`${count} low stock alerts`}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} />
        {count > 0 && <span className="bell-count">{count}</span>}
      </button>

      {open && (
        <div className="dropdown notif-dropdown">
          <div className="notif-dropdown-head">
            <div>
              <strong>Low Stock Alerts</strong>
              {count > 0 && <span className="notif-badge">{count} new</span>}
            </div>
            {count > 0 && (
              <button
                type="button"
                className="link notif-clear-btn"
                onClick={handleClearAll}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-dropdown-body">
            {count === 0 ? (
              <div className="notif-empty-state">
                <CheckCircle2 size={24} color="#10b981" />
                <p>All caught up!</p>
                <small className="muted">No unread low stock alerts right now.</small>
              </div>
            ) : (
              activeAlerts.map((a) => {
                const key = `${a.id}-${a.warehouseName}`;
                return (
                  <Link
                    key={key}
                    to={`/products/${a.id}`}
                    className="dropdown-item notif-item"
                    onClick={() => handleAlertClick(key)}
                  >
                    <div className="notif-item-left">
                      <div className="notif-sku">
                        [{a.sku}] <strong>{a.name}</strong>
                      </div>
                      <small className="muted">{a.warehouseName}</small>
                    </div>
                    <div className="notif-item-right">
                      <span className="text-danger notif-qty">
                        {fmtQty(a.onHand)} / min {fmtQty(a.minQty)}
                      </span>
                      <button
                        type="button"
                        className="notif-dismiss-btn"
                        title="Dismiss alert"
                        onClick={(e) => handleDismiss(e, key)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}