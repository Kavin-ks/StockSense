import { categoryApi } from '../../api/endpoints.js';
import { useCategories } from '../../hooks/useLookups.js';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { Alert, Button, ErrorState, Input, PageHeader, Spinner } from '../../components/ui.jsx';

export default function CategoriesPage() {
  const { data, error, loading, reload } = useCategories();
  const notify = useToast();
  const form = useForm({ name: '' }, {
    validate: (v) => (v.name.trim().length < 2 ? { name: 'Name must be at least 2 characters' } : {}),
    onSubmit: async (v) => { await categoryApi.create(v); form.setValues({ name: '' }); notify('Category created'); reload(); },
  });
  return (
    <>
      <PageHeader title="Product categories" />
      <div className="card">
        <Alert>{form.formError}</Alert>
        <form className="inline-form" onSubmit={form.handleSubmit} noValidate>
          <Input label="New category" placeholder="e.g. Furniture" {...form.bind('name')} />
          <Button type="submit" loading={form.submitting}>Add</Button>
        </form>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : (
        <DataTable rows={data} emptyTitle="No categories yet" columns={[
          { key: 'name', header: 'Name' },
          { key: 'productCount', header: 'Products', align: 'right' },
        ]} />
      )}
    </>
  );
}
