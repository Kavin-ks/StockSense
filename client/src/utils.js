// Shared validators + formatters used by forms and tables.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordProblems(pw = '') {
  const issues = [];
  if (pw.length <= 8) issues.push('more than 8 characters');
  if (!/[a-z]/.test(pw)) issues.push('a lowercase letter');
  if (!/[A-Z]/.test(pw)) issues.push('an uppercase letter');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('a special character');
  return issues;
}

// Display formats follow the signed-in user's preferences (My Profile -> Warehouse defaults).
// AuthContext calls setFormatPreferences() whenever they load or change.
const formats = { dateFormat: 'DD/MM/YYYY', numberFormat: 'standard' };
export function setFormatPreferences(prefs = {}) {
  if (prefs.dateFormat) formats.dateFormat = prefs.dateFormat;
  if (prefs.numberFormat) formats.numberFormat = prefs.numberFormat;
}

const numberLocale = () => (formats.numberFormat === 'european' ? 'de-DE' : 'en-IN');
export const fmtQty = (n) => Number(n ?? 0).toLocaleString(numberLocale(), { maximumFractionDigits: 3 });
export const fmtMoney = (n) => `${Number(n ?? 0).toLocaleString(numberLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Rs`;

export function fmtDate(d) {
  if (!d) return '—';
  // Plain 'YYYY-MM-DD' strings are calendar dates: read them as local dates, not UTC midnight.
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  if (formats.dateFormat === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  if (formats.dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}

export const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—');

/** "5 min ago" style relative time for activity feeds. */
export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d);
}
export const today = () => new Date().toISOString().slice(0, 10);

export const OPERATION_META = {
  receipt: { label: 'Receipts', single: 'Receipt', path: '/operations/receipts', contactLabel: 'Receive From' },
  delivery: { label: 'Delivery Orders', single: 'Delivery', path: '/operations/deliveries', contactLabel: 'Customer' },
  internal: { label: 'Internal Transfers', single: 'Transfer', path: '/operations/transfers', contactLabel: 'Contact' },
  adjustment: { label: 'Inventory Adjustments', single: 'Adjustment', path: '/operations/adjustments', contactLabel: 'Reason' },
};

export const STATUS_FLOW = {
  receipt: ['draft', 'ready', 'done'],
  delivery: ['draft', 'waiting', 'ready', 'done'],
  internal: ['draft', 'ready', 'done'],
  adjustment: ['done'],
};
