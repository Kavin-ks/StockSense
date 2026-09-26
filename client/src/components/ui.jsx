// Reusable presentational building blocks. Keep them dumb and composable.
import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

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

export function PasswordInput({ label, error, hint, required, ...props }) {
  const [show, setShow] = useState(false);

  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <div className="password-input-wrap">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          title={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </Field>
  );
}

export const Textarea = ({ label, error, hint, ...props }) => (
  <Field label={label} error={error} hint={hint}>
    <textarea className="input" rows={3} aria-invalid={Boolean(error)} {...props} />
  </Field>
);

export function Select({
  label,
  error,
  hint,
  required,
  options = [],
  placeholder,
  value,
  onChange,
  disabled = false,
  className = '',
  name,
  id,
  'aria-label': ariaLabel,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const strVal = value !== undefined && value !== null ? String(value) : '';
  const selectedOption = options.find((o) => String(o.value) === strVal);
  const displayLabel = selectedOption ? selectedOption.label : (placeholder !== undefined ? placeholder : 'Select...');
  const isPlaceholderSelected = !selectedOption;

  const filteredOptions = search.trim()
    ? options.filter((o) => String(o.label).toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = (optVal) => {
    if (disabled) return;
    setOpen(false);
    setSearch('');
    if (onChange) {
      onChange({
        target: {
          name,
          value: optVal,
        },
      });
    }
  };

  const content = (
    <div
      ref={containerRef}
      className={`custom-select-wrap ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${isPlaceholderSelected ? 'placeholder' : ''} ${error ? 'has-error' : ''}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel || label || placeholder}
        disabled={disabled}
      >
        <span className="custom-select-value">{displayLabel}</span>
        <ChevronDown size={14} className={`custom-select-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="custom-select-dropdown" role="listbox">
          {options.length > 7 && (
            <div className="custom-select-search-wrap">
              <Search size={13} className="custom-select-search-icon" />
              <input
                type="text"
                className="custom-select-search-input"
                placeholder="Filter options..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          )}

          <div className="custom-select-options-list">
            {placeholder !== undefined && (
              <div
                className={`custom-select-option ${strVal === '' ? 'selected' : ''}`}
                onClick={() => handleSelect('')}
                role="option"
                aria-selected={strVal === ''}
              >
                <span className="custom-select-option-text">{placeholder}</span>
                {strVal === '' && <Check size={14} className="custom-select-check" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="custom-select-empty">No options found</div>
            ) : (
              filteredOptions.map((o) => {
                const isSelected = String(o.value) === strVal;
                return (
                  <div
                    key={String(o.value)}
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(o.value)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="custom-select-option-text">{o.label}</span>
                    {isSelected && <Check size={14} className="custom-select-check" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (label || error || hint) {
    return (
      <Field label={label} error={error} hint={hint} required={required}>
        {content}
      </Field>
    );
  }

  return content;
}

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
