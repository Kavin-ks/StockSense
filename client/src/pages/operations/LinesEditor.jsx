import { Button } from '../../components/ui.jsx';
import { ProductPicker } from '../../components/ProductPicker.jsx';
import { fmtQty } from '../../utils.js';

/**
 * Editable product lines with a searchable product picker (works for any catalogue size).
 * `qtyKey` lets adjustments reuse this with "countedQty".
 * `lineInfo(line)` returns optional extra info / warnings per line (e.g. availability).
 */
export function LinesEditor({ lines, onChange, readOnly, error, qtyKey = 'quantity', qtyLabel = 'Quantity', lineInfo }) {
  const update = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i) => onChange(lines.filter((_, idx) => idx !== i));
  const used = new Set(lines.map((l) => String(l.productId)));

  return (
    <div className="lines">
      <table className="table">
        <thead><tr><th>Product</th><th style={{ width: 160, textAlign: 'right' }}>{qtyLabel}</th>{lineInfo && <th>Info</th>}{!readOnly && <th style={{ width: 48 }} />}</tr></thead>
        <tbody>
          {lines.map((l, i) => {
            const info = lineInfo?.(l);
            return (
              <tr key={i} className={info?.danger ? 'row-danger' : ''}>
                <td>
                  {readOnly ? `[${l.sku}] ${l.productName}` : (
                    <ProductPicker value={l.productId} selected={l} exclude={[...used]}
                      onSelect={(p) => update(i, { productId: String(p.id), sku: p.sku, productName: p.name, uom: p.uom })} />
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {readOnly ? fmtQty(l[qtyKey]) : (
                    <input className="input num" type="number" min="0" step="any" value={l[qtyKey] ?? ''} aria-label={qtyLabel}
                      onChange={(e) => update(i, { [qtyKey]: e.target.value })} />
                  )}
                </td>
                {lineInfo && <td className={info?.danger ? 'text-danger' : 'muted'}>{info?.text}</td>}
                {!readOnly && <td><button type="button" className="icon-btn" aria-label="Remove line" onClick={() => remove(i)}>×</button></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="field-error">{error}</p>}
      {!readOnly && <Button type="button" variant="ghost" onClick={() => onChange([...lines, { productId: '', [qtyKey]: '' }])}>+ Add a product</Button>}
    </div>
  );
}

/** Client-side line checks shared by operation and adjustment forms. */
export function validateLines(lines, qtyKey = 'quantity', allowZero = false) {
  if (!lines.length) return 'Add at least one product';
  for (const l of lines) {
    if (!l.productId) return 'Choose a product on every line';
    const q = Number(l[qtyKey]);
    if (l[qtyKey] === '' || Number.isNaN(q) || q < 0 || (!allowZero && q === 0)) {
      return allowZero ? 'Quantities cannot be negative' : 'Quantities must be greater than 0';
    }
  }
  return null;
}
