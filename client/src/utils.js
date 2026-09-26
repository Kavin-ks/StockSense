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

export const fmtQty = (n) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
export const fmtMoney = (n) => `${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Rs`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
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
