import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { operationApi } from '../../api/endpoints.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button } from '../../components/ui.jsx';
import { fmtDateTime, fmtQty } from '../../utils.js';

/**
 * Delivery picking (problem statement: pick items -> pack items -> validate).
 * Staff record the quantity picked per line, then mark the order packed; Validate unlocks after packing.
 */
export function PickPanel({ op, canProcess, onChange }) {
  const notify = useToast();
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPicked(Object.fromEntries(op.lines.map((l) => [l.id, l.pickedQty ?? ''])));
  }, [op.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (name, fn, message) => {
    setBusy(name);
    setError('');
    try {
      const updated = await fn();
      onChange(updated);
      notify(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const savePicks = (values) => run('pick', () => operationApi.pick(op.id, {
    lines: op.lines.map((l) => ({ lineId: l.id, pickedQty: Number(values[l.id] || 0) })),
  }), 'Picked quantities saved');

  const fullyPicked = op.lines.every((l) => Number(l.pickedQty ?? 0) >= Number(l.quantity));
  const editable = canProcess && !op.packedAt;

  return (
    <section className="card pick-panel">
      <div className="section-head">
        <h2><PackageCheck size={18} /> Pick &amp; pack</h2>
        {op.packedAt
          ? <span className="stock-pill stock-in">Packed by {op.packedByName} · {fmtDateTime(op.packedAt)}</span>
          : <span className="muted small-print">Step {fullyPicked ? '2 of 2: pack' : '1 of 2: pick'} — then Validate</span>}
      </div>
      <Alert>{error}</Alert>
      <table className="table">
        <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Ordered</th><th style={{ textAlign: 'right', width: 150 }}>Picked</th></tr></thead>
        <tbody>
          {op.lines.map((l) => {
            const done = Number(l.pickedQty ?? 0) >= Number(l.quantity);
            return (
              <tr key={l.id}>
                <td>[{l.sku}] {l.productName}</td>
                <td style={{ textAlign: 'right' }}>{fmtQty(l.quantity)} {l.uom}</td>
                <td style={{ textAlign: 'right' }}>
                  {editable ? (
                    <input className={`input num ${done ? '' : 'pending-pick'}`} type="number" min="0" max={l.quantity} step="any"
                      aria-label={`Picked quantity for ${l.sku}`} value={picked[l.id] ?? ''}
                      onChange={(e) => setPicked((p) => ({ ...p, [l.id]: e.target.value }))} />
                  ) : <span className={done ? '' : 'text-danger'}>{fmtQty(l.pickedQty ?? 0)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && (
        <div className="action-bar">
          <Button variant="ghost" loading={busy === 'all'} onClick={() => {
            const all = Object.fromEntries(op.lines.map((l) => [l.id, l.quantity]));
            setPicked(all);
            savePicks(all);
          }}>Pick all</Button>
          <Button variant="secondary" loading={busy === 'pick'} onClick={() => savePicks(picked)}>Save picked quantities</Button>
          <Button loading={busy === 'pack'} disabled={!fullyPicked}
            title={fullyPicked ? '' : 'Pick every line in full first'}
            onClick={() => run('pack', () => operationApi.pack(op.id), 'Delivery packed — ready to validate')}>
            Mark packed
          </Button>
        </div>
      )}
    </section>
  );
}
