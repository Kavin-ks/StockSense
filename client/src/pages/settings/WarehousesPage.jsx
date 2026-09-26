import { Breadcrumbs } from '../../components/Breadcrumbs.jsx';
import { useState } from 'react';
import { warehouseApi } from '../../api/endpoints.js';
import { useFetch } from '../../hooks/useFetch.js';
import { ArchiveButton, ShowArchivedToggle } from '../../components/ArchiveButton.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Alert, Button, ErrorState, Input, Modal, PageHeader, Spinner, Textarea } from '../../components/ui.jsx';

function WarehouseModal({ warehouse, onClose, onSaved }) {
  const notify = useToast();
  const form = useForm({ name: warehouse?.name ?? '', shortCode: warehouse?.shortCode ?? '', address: warehouse?.address ?? '' }, {
    validate: (v) => ({
      ...(v.name.trim().length < 2 && { name: 'Name must be at least 2 characters' }),
      ...(!/^[A-Za-z0-9-]{1,10}$/.test(v.shortCode.trim()) && { shortCode: 'Short code must be 1-10 letters, numbers or "-"' }),
    }),
    onSubmit: async (v) => {
      await (warehouse ? warehouseApi.update(warehouse.id, v) : warehouseApi.create(v));
      notify(`Warehouse ${warehouse ? 'updated' : 'created'}`);
      onSaved();
    },
  });
  return (
    <Modal title={warehouse ? 'Edit warehouse' : 'New warehouse'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={form.handleSubmit} loading={form.submitting}>Save</Button></>}>
      <form className="stack" onSubmit={form.handleSubmit} noValidate>
        <Alert>{form.formError}</Alert>
        <Input label="Name" required autoFocus {...form.bind('name')} />
        <Input label="Short code" required hint="Used in references, e.g. WH/IN/0001" {...form.bind('shortCode')} />
        <Textarea label="Address" {...form.bind('address')} />
      </form>
    </Modal>
  );
}

export default function WarehousesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, loading, reload } = useFetch(
    () => warehouseApi.list(showArchived ? { includeArchived: 'true' } : {}), [showArchived], { live: ['warehouses', 'locations'] });
  const [editing, setEditing] = useState(undefined);
  const canWrite = useAuth().can('settings.write'); // undefined = closed, null = new
  return (
    <>
      <Breadcrumbs items={[{ label: 'Settings' }, { label: 'Warehouses' }]} />
      <PageHeader title="Warehouses" subtitle="Warehouse details and addresses">
        <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} />
        {canWrite && <Button onClick={() => setEditing(null)}>New warehouse</Button>}
      </PageHeader>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : (
        <DataTable rows={data} onRowClick={canWrite ? setEditing : undefined} emptyTitle="No warehouses yet"
          emptyText="Add your first warehouse; it gets a default STOCK location automatically."
          rowClassName={(w) => (w.isActive ? '' : 'dimmed')} columns={[
          { key: 'name', header: 'Name', render: (w) => <><strong>{w.name}</strong>{!w.isActive && <span className="badge badge-canceled" style={{ marginLeft: 8 }}>archived</span>}</> },
          { key: 'shortCode', header: 'Short code', render: (w) => <code>{w.shortCode}</code> },
          { key: 'address', header: 'Address', render: (w) => w.address || '—' },
          { key: 'locationCount', header: 'Locations', align: 'right' },
          ...(canWrite ? [{ key: 'act', header: '', align: 'right',
            render: (w) => <ArchiveButton item={w} api={warehouseApi} label={`Warehouse ${w.name}`} onDone={reload} /> }] : []),
        ]} />
      )}
      {editing !== undefined && <WarehouseModal warehouse={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </>
  );
}
