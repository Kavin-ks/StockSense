import { useState } from 'react';
import { warehouseApi } from '../../api/endpoints.js';
import { useWarehouses } from '../../hooks/useLookups.js';
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
  const { data, error, loading, reload } = useWarehouses();
  const [editing, setEditing] = useState(undefined);
  const canWrite = useAuth().can('settings.write'); // undefined = closed, null = new
  return (
    <>
      <PageHeader title="Warehouses" subtitle="Warehouse details and addresses">
        {canWrite && <Button onClick={() => setEditing(null)}>New warehouse</Button>}
      </PageHeader>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : (
        <DataTable rows={data} onRowClick={canWrite ? setEditing : undefined} emptyTitle="No warehouses yet" columns={[
          { key: 'name', header: 'Name', render: (w) => <strong>{w.name}</strong> },
          { key: 'shortCode', header: 'Short code', render: (w) => <code>{w.shortCode}</code> },
          { key: 'address', header: 'Address', render: (w) => w.address || '—' },
          { key: 'locationCount', header: 'Locations', align: 'right' },
        ]} />
      )}
      {editing !== undefined && <WarehouseModal warehouse={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </>
  );
}
