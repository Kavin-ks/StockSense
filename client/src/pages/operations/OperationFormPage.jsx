import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { operationApi } from '../../api/endpoints.js';
import { useForm } from '../../hooks/useForm.js';
import { toOptions, useLocations, useUsers, useWarehouses } from '../../hooks/useLookups.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLiveRefresh } from '../../hooks/useLiveRefresh.js';
import { Alert, Button, ErrorState, Input, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../../components/ui.jsx';
import { OPERATION_META, STATUS_FLOW, fmtDate, fmtQty, today } from '../../utils.js';
import { LinesEditor, validateLines } from './LinesEditor.jsx';

const EMPTY = { warehouseId: '', sourceLocationId: '', destLocationId: '', contact: '', deliveryAddress: '', scheduledDate: today(), responsibleId: '', notes: '', lines: [] };

function StatusPipeline({ type, status }) {
  const flow = STATUS_FLOW[type];
  const idx = flow.indexOf(status);
  if (status === 'canceled') return <StatusBadge status="canceled" />;
  return (
    <ol className="pipeline" aria-label="Status">
      {flow.map((s, i) => <li key={s} className={i < idx ? 'past' : i === idx ? 'current' : ''}>{s}</li>)}
    </ol>
  );
}

const fromOperation = (op) => ({
  warehouseId: String(op.warehouseId),
  sourceLocationId: String(op.sourceLocationId),
  destLocationId: String(op.destLocationId),
  contact: op.contact ?? '',
  deliveryAddress: op.deliveryAddress ?? '',
  scheduledDate: op.scheduledDate,
  responsibleId: op.responsibleId ? String(op.responsibleId) : '',
  notes: op.notes ?? '',
  lines: op.lines.map((l) => ({ ...l, productId: String(l.productId) })),
});

export default function OperationFormPage({ type }) {
  const meta = OPERATION_META[type];
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const notify = useToast();
  const [op, setOp] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [acting, setActing] = useState('');
  const [actionError, setActionError] = useState('');
  const [staleNotice, setStaleNotice] = useState('');
  const { can } = useAuth();
  const canManage = can(`${type}.manage`);   // create / edit / cancel
  const canProcess = can(`${type}.process`); // To Do / Validate

  const form = useForm(EMPTY, {
    validate: (v) => {
      const e = {};
      if (!v.warehouseId) e.warehouseId = 'Warehouse is required';
      if (type !== 'internal' && !v.contact.trim()) e.contact = `${meta.contactLabel} is required`;
      if (type === 'internal') {
        if (!v.sourceLocationId) e.sourceLocationId = 'Source location is required';
        if (!v.destLocationId) e.destLocationId = 'Destination location is required';
        if (v.sourceLocationId && v.sourceLocationId === v.destLocationId) e.destLocationId = 'Destination must differ from source';
      }
      if (!v.scheduledDate) e.scheduledDate = 'Schedule date is required';
      const lineErr = validateLines(v.lines);
      if (lineErr) e.lines = lineErr;
      return e;
    },
    onSubmit: async (v) => {
      const body = { ...v, type, lines: v.lines.map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity) })) };
      if (type === 'receipt') delete body.sourceLocationId;
      if (type === 'delivery') delete body.destLocationId;
      // expectedUpdatedAt lets the server reject the save if someone else changed the document meanwhile.
      const saved = isNew ? await operationApi.create(body) : await operationApi.update(id, { ...body, expectedUpdatedAt: op.updatedAt });
      setStaleNotice('');
      notify(`${saved.reference} saved`);
      setOp(saved);
      form.setValues(fromOperation(saved));
      if (isNew) navigate(`${meta.path}/${saved.id}`, { replace: true });
    },
  });
  const { values, set, bind, errors } = form;

  const load = () => operationApi.get(id).then((o) => { setOp(o); form.setValues(fromOperation(o)); setStaleNotice(''); });
  useEffect(() => {
    if (isNew) return;
    load().catch(setLoadError);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: another user changed this document, or stock of one of its products moved.
  // Status, pipeline and availability always refresh; the user's unsaved edits are never overwritten.
  useLiveRefresh(isNew ? null : ['operations', 'stock'], async (event) => {
    const latest = await operationApi.get(id).catch(() => null);
    if (!latest) return;
    setOp(latest);
    if (!form.dirty) form.setValues(fromOperation(latest));
    else if (event.topic === 'operations') setStaleNotice(`${event.actorName ?? 'Someone'} changed this document while you were editing.`);
  }, {
    filter: (e) => (e.topic === 'operations' ? e.id === Number(id) : op?.lines?.some((l) => e.productIds?.includes(l.productId))),
  });

  const { data: warehouses } = useWarehouses();
  const { data: users } = useUsers();
  const { data: whLocations } = useLocations(values.warehouseId);
  const { data: allLocations } = useLocations();

  // Default the warehouse to the first one for new documents.
  useEffect(() => {
    if (isNew && !values.warehouseId && warehouses?.length) set('warehouseId', String(warehouses[0].id));
  }, [warehouses]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <ErrorState error={loadError} />;
  if (isNew && !canManage) return <ErrorState error={{ message: `Only inventory managers can create ${meta.label.toLowerCase()}.` }} />;
  if (!isNew && !op) return <Spinner />;

  const status = op?.status ?? 'draft';
  const open = !['done', 'canceled'].includes(status);
  const editable = open && canManage;
  const locOptions = toOptions(whLocations, 'fullCode');

  const act = async (name, fn, message) => {
    setActing(name);
    setActionError('');
    try {
      const updated = await fn(op.id);
      setOp(updated);
      form.setValues(fromOperation(updated));
      notify(message(updated));
    } catch (err) {
      setActionError(err.message);
      if (err.status === 409) load().catch(() => {}); // someone else acted first: show the real state
    } finally {
      setActing('');
    }
  };

  const lineInfo = type === 'receipt' ? undefined : (l) => {
    if (l.available === undefined) return null;
    return l.inStock ? { text: `${fmtQty(l.available)} available` } : { danger: true, text: `Only ${fmtQty(l.available)} in stock` };
  };
  const shortLines = op?.lines?.filter((l) => !l.inStock).length ?? 0;

  return (
    <div className="print-area">
      <PageHeader title={isNew ? `New ${meta.single}` : op.reference} subtitle={meta.label}>
        {!isNew && <StatusPipeline type={type} status={status} />}
      </PageHeader>

      <div className="action-bar no-print">
        {editable && <Button onClick={form.handleSubmit} loading={form.submitting}>Save</Button>}
        {op && canProcess && status === 'draft' && <Button variant="secondary" loading={acting === 'confirm'}
          onClick={() => act('confirm', operationApi.confirm, (o) => `${o.reference} is ${o.status}`)}>To Do</Button>}
        {op && canProcess && ['ready', 'waiting'].includes(status) && <Button variant="success" loading={acting === 'validate'}
          onClick={() => act('validate', operationApi.validate, (o) => `${o.reference} validated — stock updated`)}>Validate</Button>}
        {op && status === 'done' && <Button variant="ghost" onClick={() => window.print()}>Print</Button>}
        {op && editable && <Button variant="danger-ghost" loading={acting === 'cancel'}
          onClick={() => window.confirm(`Cancel ${op.reference}?`) && act('cancel', operationApi.cancel, (o) => `${o.reference} canceled`)}>Cancel</Button>}
        <div className="spacer" />
        <Button variant="ghost" onClick={() => navigate(meta.path)}>Back to list</Button>
      </div>

      <Alert>{actionError || form.formError}</Alert>
      {(staleNotice || form.formError.startsWith('Someone else changed')) && (
        <div className="alert alert-warn readonly-note no-print">
          <span>{staleNotice || 'This document was updated by someone else.'} Reload to see the latest version (your unsaved edits will be discarded).</span>
          <Button variant="ghost" onClick={() => load().then(() => form.setFormError(''))}>Reload</Button>
        </div>
      )}
      {!isNew && open && !canManage && (
        <Alert tone="info">{meta.label} are planned by inventory managers. {canProcess ? 'You can mark it To Do and validate it once the goods are handled.' : ''}</Alert>
      )}
      {type === 'delivery' && shortLines > 0 && open && (
        <Alert tone="warn">{shortLines} product line(s) are not fully in stock. The delivery will wait until stock arrives.</Alert>
      )}

      <form className="card form-grid" onSubmit={form.handleSubmit} noValidate>
        <Select label="Warehouse" required options={toOptions(warehouses)} placeholder="Select…" disabled={!isNew}
          {...bind('warehouseId')} onChange={(e) => { set('warehouseId', e.target.value); set('sourceLocationId', ''); set('destLocationId', ''); }} />
        <Input label="Operation type" value={meta.single} disabled readOnly />
        {type !== 'internal' && <Input label={meta.contactLabel} required disabled={!editable} {...bind('contact')} />}
        {type === 'receipt' && <Select label="Destination location" options={locOptions} placeholder="Default stock location" disabled={!editable} {...bind('destLocationId')} />}
        {type !== 'receipt' && <Select label="Source location" required={type === 'internal'} options={locOptions}
          placeholder={type === 'delivery' ? 'Default stock location' : 'Select…'} disabled={!editable} {...bind('sourceLocationId')} />}
        {type === 'internal' && <Select label="Destination location" required options={toOptions(allLocations, 'fullCode')} placeholder="Select…" disabled={!editable} {...bind('destLocationId')} />}
        {type === 'delivery' && <Input label="Delivery address" disabled={!editable} {...bind('deliveryAddress')} />}
        <Input label="Schedule date" type="date" required disabled={!editable} {...bind('scheduledDate')} />
        <Select label="Responsible" options={toOptions(users)} placeholder="Me (current user)" disabled={!editable} {...bind('responsibleId')} />
        {op?.validatedAt && <Input label="Validated on" value={fmtDate(op.validatedAt)} disabled readOnly />}
        <div className="span-all"><Textarea label="Notes" disabled={!editable} {...bind('notes')} /></div>

        <div className="span-all">
          <h2>Products</h2>
          <LinesEditor lines={values.lines} readOnly={!editable} error={errors.lines}
            onChange={(lines) => set('lines', lines)} lineInfo={lineInfo} />
        </div>
      </form>
    </div>
  );
}
