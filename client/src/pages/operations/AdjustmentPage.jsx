import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { operationApi, productApi } from '../../api/endpoints.js';
import { useForm } from '../../hooks/useForm.js';
import { toOptions, useLocations } from '../../hooks/useLookups.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLiveRefresh } from '../../hooks/useLiveRefresh.js';
import { Alert, Button, ErrorState, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../../components/ui.jsx';
import { fmtDate, fmtQty } from '../../utils.js';
import { LinesEditor, validateLines } from './LinesEditor.jsx';

/** New adjustment: pick a location, enter counted quantities; the difference is posted to the ledger. */
function NewAdjustment() {
  const navigate = useNavigate();
  const notify = useToast();
  const { data: locations } = useLocations();
  const [recorded, setRecorded] = useState({});
  const [stockVersion, setStockVersion] = useState(0);
  const [params] = useSearchParams();
  // "Update" on the Stock page opens this form with the product (and optionally location) pre-filled.
  const preset = {
    locationId: params.get('locationId') ?? '',
    notes: '',
    lines: params.get('productId') ? [{ productId: params.get('productId'), countedQty: '' }] : [],
  };

  const form = useForm(preset, {
    validate: (v) => {
      const e = {};
      if (!v.locationId) e.locationId = 'Location is required';
      const lineErr = validateLines(v.lines, 'countedQty', true);
      if (lineErr) e.lines = lineErr;
      return e;
    },
    onSubmit: async (v) => {
      const op = await operationApi.adjust({ ...v, lines: v.lines.map((l) => ({ productId: Number(l.productId), countedQty: Number(l.countedQty) })) });
      notify(`${op.reference} applied — stock updated`);
      navigate(`/operations/adjustments/${op.id}`, { replace: true });
    },
  });

  // Show the currently recorded qty at the chosen location next to each counted line.
  const productIds = form.values.lines.map((l) => l.productId).filter(Boolean).join(',');
  useEffect(() => {
    if (!form.values.locationId) return;
    Promise.all(productIds.split(',').filter(Boolean).map((pid) => productApi.get(pid))).then((ps) => {
      const map = {};
      for (const p of ps) map[p.id] = p.stockByLocation.find((s) => String(s.locationId) === form.values.locationId)?.quantity ?? 0;
      setRecorded(map);
    }).catch(() => {});
  }, [productIds, form.values.locationId, stockVersion]);
  // Someone else moved stock while this count is being entered: refresh the "Recorded" figures.
  useLiveRefresh(['stock'], () => setStockVersion((v) => v + 1));

  const lineInfo = (l) => {
    if (!l.productId || !form.values.locationId || recorded[l.productId] === undefined) return null;
    const diff = Number(l.countedQty || 0) - recorded[l.productId];
    return { text: `Recorded ${fmtQty(recorded[l.productId])} → ${diff >= 0 ? '+' : ''}${fmtQty(diff)}`, danger: diff < 0 };
  };

  return (
    <>
      <PageHeader title="New Inventory Adjustment" subtitle="Fix mismatches between recorded stock and the physical count" />
      <Alert>{form.formError}</Alert>
      <form className="card form-grid" onSubmit={form.handleSubmit} noValidate>
        <Select label="Location" required placeholder="Select…" options={toOptions(locations, 'fullCode')} {...form.bind('locationId')} />
        <Textarea label="Reason / notes" placeholder="e.g. 3 kg steel damaged" {...form.bind('notes')} />
        <div className="span-all">
          <h2>Counted products</h2>
          <LinesEditor lines={form.values.lines} qtyKey="countedQty" qtyLabel="Counted qty" lineInfo={lineInfo}
            error={form.errors.lines} onChange={(lines) => form.set('lines', lines)} />
        </div>
        <div className="span-all action-bar">
          <Button type="submit" loading={form.submitting}>Apply adjustment</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/operations/adjustments')}>Cancel</Button>
        </div>
      </form>
    </>
  );
}

function AdjustmentDetail({ id }) {
  const [op, setOp] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { operationApi.get(id).then(setOp).catch(setError); }, [id]);
  if (error) return <ErrorState error={error} />;
  if (!op) return <Spinner />;
  return (
    <div className="print-area">
      <PageHeader title={op.reference} subtitle={`Inventory adjustment · ${op.destLocation} · ${fmtDate(op.validatedAt)}`}>
        <StatusBadge status={op.status} />
        <Button variant="ghost" className="no-print" onClick={() => window.print()}>Print</Button>
        <Button variant="ghost" className="no-print" onClick={() => navigate('/operations/adjustments')}>Back</Button>
      </PageHeader>
      <div className="card">
        {op.notes && <p>{op.notes}</p>}
        <table className="table">
          <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Counted</th><th style={{ textAlign: 'right' }}>Difference posted</th></tr></thead>
          <tbody>{op.lines.map((l) => (
            <tr key={l.id}><td>[{l.sku}] {l.productName}</td><td style={{ textAlign: 'right' }}>{fmtQty(l.countedQty)} {l.uom}</td><td style={{ textAlign: 'right' }}>{fmtQty(l.quantity)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdjustmentPage() {
  const { id } = useParams();
  return id === 'new' ? <NewAdjustment /> : <AdjustmentDetail id={id} />;
}
