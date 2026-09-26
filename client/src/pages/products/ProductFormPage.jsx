import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productApi } from '../../api/endpoints.js';
import { useForm } from '../../hooks/useForm.js';
import { useFetch } from '../../hooks/useFetch.js';
import { toOptions, useCategories, useLocations, useWarehouses } from '../../hooks/useLookups.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLiveRefresh } from '../../hooks/useLiveRefresh.js';
import { Alert, Button, ErrorState, Input, PageHeader, Select, Spinner } from '../../components/ui.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { fmtQty } from '../../utils.js';

const EMPTY = { name: '', sku: '', categoryId: '', uom: 'Units', unitCost: '0', initialStock: '', initialLocationId: '' };

function validateProduct(v, isNew) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(v.sku.trim())) e.sku = 'SKU must be 2-40 letters, numbers, "-" or "_"';
  if (v.unitCost === '' || Number(v.unitCost) < 0 || Number.isNaN(Number(v.unitCost))) e.unitCost = 'Unit cost must be 0 or more';
  if (isNew && v.initialStock !== '') {
    if (Number(v.initialStock) < 0 || Number.isNaN(Number(v.initialStock))) e.initialStock = 'Initial stock cannot be negative';
    else if (Number(v.initialStock) > 0 && !v.initialLocationId) e.initialLocationId = 'Choose a location for the initial stock';
  }
  return e;
}

function ReorderRules({ product, onChange, readOnly }) {
  const { data: warehouses } = useWarehouses();
  const notify = useToast();
  const form = useForm({ warehouseId: '', minQty: '', maxQty: '' }, {
    validate: (v) => {
      const e = {};
      if (!v.warehouseId) e.warehouseId = 'Required';
      if (v.minQty === '' || Number(v.minQty) < 0) e.minQty = 'Must be 0 or more';
      if (v.maxQty === '' || Number(v.maxQty) < Number(v.minQty)) e.maxQty = 'Must be ≥ minimum';
      return e;
    },
    onSubmit: async (v) => {
      onChange(await productApi.saveRule(product.id, { warehouseId: Number(v.warehouseId), minQty: Number(v.minQty), maxQty: Number(v.maxQty) }));
      form.setValues({ warehouseId: '', minQty: '', maxQty: '' });
      notify('Reordering rule saved');
    },
  });
  return (
    <div className="card">
      <h2>Reordering rules</h2>
      <p className="muted">You will be alerted when on-hand stock in a warehouse drops to the minimum.</p>
      <DataTable rows={product.reorderRules} emptyTitle="No rules yet" columns={[
        { key: 'warehouseName', header: 'Warehouse' },
        { key: 'minQty', header: 'Min', align: 'right', render: (r) => fmtQty(r.minQty) },
        { key: 'maxQty', header: 'Max', align: 'right', render: (r) => fmtQty(r.maxQty) },
        { key: 'x', header: '', align: 'right', render: (r) => !readOnly && <button className="icon-btn" aria-label="Delete rule" onClick={async () => onChange(await productApi.deleteRule(product.id, r.id))}>×</button> },
      ]} />
      <Alert>{form.formError}</Alert>
      {!readOnly && <form className="inline-form" onSubmit={form.handleSubmit} noValidate>
        <Select label="Warehouse" placeholder="Select…" options={toOptions(warehouses)} {...form.bind('warehouseId')} />
        <Input label="Min qty" type="number" min="0" step="any" {...form.bind('minQty')} />
        <Input label="Max qty" type="number" min="0" step="any" {...form.bind('maxQty')} />
        <Button type="submit" loading={form.submitting}>Save rule</Button>
      </form>}
    </div>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const notify = useToast();
  const [product, setProduct] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [staleNotice, setStaleNotice] = useState('');
  const { can } = useAuth();
  const canWrite = can('products.write');
  const { data: categories } = useCategories();
  const { data: uoms } = useFetch(() => productApi.uoms(), []);
  const { data: locations } = useLocations();

  const form = useForm(EMPTY, {
    validate: (v) => validateProduct(v, isNew),
    onSubmit: async (v) => {
      const body = { name: v.name, sku: v.sku, categoryId: v.categoryId || undefined, uom: v.uom, unitCost: Number(v.unitCost) };
      if (isNew && Number(v.initialStock) > 0) Object.assign(body, { initialStock: Number(v.initialStock), initialLocationId: Number(v.initialLocationId) });
      const saved = isNew ? await productApi.create(body) : await productApi.update(id, { ...body, expectedUpdatedAt: product.updatedAt });
      setStaleNotice('');
      notify(`${saved.name} saved`);
      setProduct(saved);
      if (isNew) navigate(`/products/${saved.id}`, { replace: true });
    },
  });

  const toValues = (p) => ({ ...EMPTY, name: p.name, sku: p.sku, categoryId: p.categoryId ? String(p.categoryId) : '', uom: p.uom, unitCost: String(p.unitCost) });
  const load = () => productApi.get(id).then((p) => { setProduct(p); form.setValues(toValues(p)); setStaleNotice(''); });
  useEffect(() => {
    if (isNew) return;
    load().catch(setLoadError);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: stock per location / rules always refresh; unsaved edits to the form are kept.
  useLiveRefresh(isNew ? null : ['products', 'stock'], async (event) => {
    const latest = await productApi.get(id).catch(() => null);
    if (!latest) return;
    setProduct(latest);
    if (!form.dirty) form.setValues(toValues(latest));
    else if (event.topic === 'products' && event.action === 'updated') setStaleNotice(`${event.actorName ?? 'Someone'} changed this product while you were editing.`);
  }, { filter: (e) => (e.topic === 'products' ? e.id === Number(id) : e.productIds?.includes(Number(id))) });

  if (loadError) return <ErrorState error={loadError} />;
  if (isNew && !canWrite) return <ErrorState error={{ message: 'Only inventory managers can create products.' }} />;
  if (!isNew && !product) return <Spinner />;

  return (
    <>
      <PageHeader title={isNew ? 'New product' : product.name} subtitle={isNew ? undefined : `SKU ${product.sku}`}>
        <Button variant="ghost" onClick={() => navigate('/products')}>Back</Button>
      </PageHeader>
      <Alert>{form.formError}</Alert>
      {(staleNotice || form.formError.startsWith('Someone else changed')) && (
        <div className="alert alert-warn readonly-note">
          <span>{staleNotice || 'This product was updated by someone else.'} Reload to see the latest version.</span>
          <Button variant="ghost" onClick={() => load().then(() => form.setFormError(''))}>Reload</Button>
        </div>
      )}
      {!canWrite && <Alert tone="info">Products are maintained by inventory managers. You have view-only access.</Alert>}
      <form className="card form-grid" onSubmit={form.handleSubmit} noValidate>
        <fieldset className="contents" disabled={!canWrite}>
        <Input label="Name" required {...form.bind('name')} />
        <Input label="SKU / Code" required {...form.bind('sku')} />
        <Select label="Category" placeholder="Uncategorised" options={toOptions(categories)} {...form.bind('categoryId')} />
        <Select label="Unit of measure" required options={(uoms ?? ['Units']).map((u) => ({ value: u, label: u }))} {...form.bind('uom')} />
        <Input label="Per unit cost (Rs)" type="number" min="0" step="0.01" {...form.bind('unitCost')} />
        {isNew && <>
          <Input label="Initial stock (optional)" type="number" min="0" step="any" {...form.bind('initialStock')} />
          <Select label="Initial stock location" placeholder="Select…" options={toOptions(locations, 'fullCode')} {...form.bind('initialLocationId')} />
        </>}
        </fieldset>
        {canWrite && <div className="span-all"><Button type="submit" loading={form.submitting}>{isNew ? 'Create product' : 'Save changes'}</Button></div>}
      </form>

      {product && (
        <div className="grid-2">
          <div className="card">
            <h2>Stock per location</h2>
            <p className="muted">On hand {fmtQty(product.onHand)} {product.uom} · Free to use {fmtQty(product.freeToUse)}</p>
            <DataTable rows={product.stockByLocation} emptyTitle="No stock yet" columns={[
              { key: 'location', header: 'Location' },
              { key: 'warehouseName', header: 'Warehouse' },
              { key: 'quantity', header: 'Quantity', align: 'right', render: (r) => fmtQty(r.quantity) },
            ]} />
          </div>
          <ReorderRules product={product} onChange={setProduct} readOnly={!canWrite} />
        </div>
      )}
    </>
  );
}
