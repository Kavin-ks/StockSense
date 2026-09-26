// Reusable presentational building blocks. Keep them dumb and composable.
import { useEffect, useState } from 'react';

export function Field({ label, error, hint, children, required }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      {label && <span className="field-label">{label}{required && <span className="req"> *</span>}</span>}
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export const Input = ({ label, error, hint, required, ...props }) => (
  <Field label={label} error={error} hint={hint} required={required}>
    <input className="input" aria-invalid={Boolean(error)} {...props} />
  </Field>
);

export const Textarea = ({ label, error, hint, ...props }) => (
  <Field label={label} error={error} hint={hint}>
    <textarea className="input" rows={3} aria-invalid={Boolean(error)} {...props} />
  </Field>
);

export const Select = ({ label, error, hint, required, options = [], placeholder, ...props }) => (
  <Field label={label} error={error} hint={hint} required={required}>
    <select className="input" aria-invalid={Boolean(error)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

export function Button({ variant = 'primary', loading, children, className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`} {...props} disabled={loading || props.disabled}>
      {loading ? <span className="spinner sm" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="page-actions">{children}{actions}</div>
    </div>
  );
}

export const StatusBadge = ({ status }) => <span className={`badge badge-${status}`}>{status}</span>;

export const Spinner = () => <div className="center-pad"><span className="spinner" aria-label="Loading" /></div>;

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty error-state">
      <p>{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export const EmptyState = ({ title, children }) => (
  <div className="empty"><strong>{title}</strong>{children && <p className="muted">{children}</p>}</div>
);

export function Alert({ tone = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${tone}`} role="alert">{children}</div>;
}

/** Search box that debounces typing so we don't hit the API on every keystroke. */
export function SearchInput({ value, onChange, placeholder = 'Search…', delay = 300 }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  useEffect(() => {
    if (text === (value ?? '')) return undefined;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input className="input search" type="search" placeholder={placeholder} value={text}
      onChange={(e) => setText(e.target.value)} aria-label={placeholder} />
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="pagination">
      <span className="muted">Page {meta.page} of {meta.totalPages} · {meta.total} records</span>
      <Button variant="ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
      <Button variant="ghost" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</Button>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ViewToggle({ view, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {['list', 'kanban'].map((v) => (
        <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => onChange(v)}>
          {v === 'list' ? 'List' : 'Kanban'}
        </button>
      ))}
    </div>
  );
}
