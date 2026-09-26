import { useEffect, useId, useRef, useState } from 'react';
import { productApi } from '../api/endpoints.js';
import { fmtQty } from '../utils.js';

/**
 * Search-as-you-type product picker (scales to any catalogue size).
 * Queries the API (debounced, 20 results) instead of loading every product into the page.
 * Keyboard: ArrowUp/ArrowDown to move, Enter to choose, Escape to close.
 * `value` is the selected product id, `selected` its { sku, productName } for display.
 */
export function ProductPicker({ value, selected, onSelect, exclude = [], placeholder = 'Search product by name or SKU…', invalid }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const requestId = useRef(0);
  const label = value && selected?.sku ? `[${selected.sku}] ${selected.productName}` : '';

  useEffect(() => {
    if (!open) return undefined;
    const id = ++requestId.current;
    setLoading(true);
    const t = setTimeout(() => {
      productApi.list({ search: text.trim() || undefined, pageSize: 20 })
        .then((r) => { if (id === requestId.current) { setResults(r.data); setActive(0); } })
        .catch(() => { if (id === requestId.current) setResults([]); })
        .finally(() => { if (id === requestId.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [text, open]);

  const excluded = new Set(exclude.map(String));
  const options = results.filter((p) => !excluded.has(String(p.id)) || String(p.id) === String(value));

  const choose = (p) => {
    onSelect({ id: p.id, sku: p.sku, name: p.name, onHand: p.onHand, uom: p.uom });
    setOpen(false);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="picker">
      <input
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={Boolean(invalid)}
        aria-label="Product"
        placeholder={label || placeholder}
        value={open ? text : label}
        onFocus={() => { setOpen(true); setText(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="picker-list" id={listId} role="listbox">
          {loading && !options.length && <li className="picker-empty">Searching…</li>}
          {!loading && !options.length && <li className="picker-empty">No matching products</li>}
          {options.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              onMouseEnter={() => setActive(i)}>
              <span><code>{p.sku}</code> {p.name}</span>
              <span className={p.onHand > 0 ? 'muted' : 'text-danger'}>{fmtQty(p.onHand)} {p.uom}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
