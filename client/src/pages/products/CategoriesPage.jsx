import { categoryApi } from '../../api/endpoints.js';
import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch.js';
import { ArchiveButton, ShowArchivedToggle } from '../../components/ArchiveButton.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Alert, Button, ErrorState, Input, PageHeader, Spinner } from '../../components/ui.jsx';

export default function CategoriesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, loading, reload } = useFetch(
    () => categoryApi.list(showArchived ? { includeArchived: 'true' } : {}), [showArchived], { live: ['categories', 'products'] });
  const notify = useToast();
  const { can } = useAuth();
  const form = useForm({ name: '' }, {
    validate: (v) => (v.name.trim().length < 2 ? { name: 'Name must be at least 2 characters' } : {}),
    // Reload immediately for this user; other users get it through the 'categories' live event.
    onSubmit: async (v) => { await categoryApi.create(v); form.setValues({ name: '' }); notify('Category created'); reload(); },
  });
  return (
    <>
      <PageHeader title="Product categories">
        <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} />
      </PageHeader>
      {can('products.write') && <div className="card">
        <Alert>{form.formError}</Alert>
        <form className="inline-form" onSubmit={form.handleSubmit} noValidate>
          <Input label="New category" placeholder="e.g. Furniture" {...form.bind('name')} />
          <Button type="submit" loading={form.submitting}>Add</Button>
        </form>
      </div>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : (
        <DataTable rows={data} emptyTitle="No categories yet" emptyText="Categories group products for filtering and reports."
          rowClassName={(c) => (c.isActive ? '' : 'dimmed')} columns={[
          { key: 'name', header: 'Name', render: (c) => <>{c.name}{!c.isActive && <span className="badge badge-canceled" style={{ marginLeft: 8 }}>archived</span>}</> },
          { key: 'productCount', header: 'Products', align: 'right' },
          ...(can('products.write') ? [{ key: 'act', header: '', align: 'right',
            render: (c) => <ArchiveButton item={c} api={categoryApi} label={`Category ${c.name}`} onDone={reload} /> }] : []),
        ]} />
      )}
    </>
  );
}
