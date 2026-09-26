import { useState } from 'react';
import { locationApi } from '../../api/endpoints.js';
import { toOptions, useLocations, useWarehouses } from '../../hooks/useLookups.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Alert, Button, ErrorState, Input, Modal, PageHeader, Select, Spinner } from '../../components/ui.jsx';

function LocationModal({ location, warehouses, defaultWarehouseId, onClose, onSaved }) {
  const notify = useToast();
  const form = useForm({
    warehouseId: String(location?.warehouseId ?? defaultWarehouseId ?? ''),
    name: location?.name ?? '',
    shortCode: location?.shortCode ?? '',
  }, {
    validate: (v) => ({
      ...(!v.warehouseId && { warehouseId: 'Warehouse is required' }),
      ...(!v.name.trim() && { name: 'Name is required' }),
      ...(!/^[A-Za-z0-9-]{1,20}$/.test(v.shortCode.trim()) && { shortCode: 'Short code must be 1-20 letters, numbers or "-"' }),
    }),
    onSubmit: async (v) => {
      const body = { ...v, warehouseId: Number(v.warehouseId) };
      await (location ? locationApi.update(location.id, body) : locationApi.create(body));
      notify(`Location ${location ? 'updated' : 'created'}`);
      onSaved();
    },
  });
  return (
    <Modal title={location ? 'Edit location' : 'New location'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={form.handleSubmit} loading={form.submitting}>Save</Button></>}>
      <form className="stack" onSubmit={form.handleSubmit} noValidate>
        <Alert>{form.formError}</Alert>
        <Select label="Warehouse" required placeholder="Select…" options={toOptions(warehouses)} {...form.bind('warehouseId')} />
        <Input label="Name" required placeholder="e.g. Rack A" {...form.bind('name')} />
        <Input label="Short code" required placeholder="e.g. RACK-A" {...form.bind('shortCode')} />
      </form>
    </Modal>
  );
}

/** Locations = racks, rooms, shelves etc. inside a warehouse. */
export default function LocationsPage() {
  const [q, setQ] = useQueryState({});
  const { data: warehouses } = useWarehouses();
  const { data, error, loading, reload } = useLocations(q.warehouseId);
  const [editing, setEditing] = useState(undefined);
  const canWrite = useAuth().can('settings.write');
  return (
    <>
      <PageHeader title="Locations" subtitle="Racks, rooms and zones inside each warehouse">
        <Select placeholder="All warehouses" value={q.warehouseId ?? ''} options={toOptions(warehouses)} onChange={(e) => setQ({ warehouseId: e.target.value })} aria-label="Warehouse" />
        {canWrite && <Button onClick={() => setEditing(null)}>New location</Button>}
      </PageHeader>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : (
        <DataTable rows={data} onRowClick={canWrite ? setEditing : undefined} emptyTitle="No locations yet" columns={[
          { key: 'fullCode', header: 'Code', render: (l) => <code>{l.fullCode}</code> },
          { key: 'name', header: 'Name' },
          { key: 'warehouseName', header: 'Warehouse' },
        ]} />
      )}
      {editing !== undefined && <LocationModal location={editing} warehouses={warehouses} defaultWarehouseId={q.warehouseId}
        onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </>
  );
}
