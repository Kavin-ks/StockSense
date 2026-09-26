import { useState } from 'react';
import { userApi } from '../../api/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useForm } from '../../hooks/useForm.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { DataTable } from '../../components/DataTable.jsx';
import { Alert, Button, ErrorState, Input, Modal, PageHeader, Pagination, PasswordInput, SearchInput, Select, Spinner } from '../../components/ui.jsx';
import { validateSignup } from '../auth/SignupPage.jsx';
import { fmtDate } from '../../utils.js';

const ROLE_OPTIONS = [
  { value: 'staff', label: 'Warehouse Staff' },
  { value: 'manager', label: 'Inventory Manager' },
];
const ROLE_HELP = {
  staff: 'Transfers, counting (adjustments), and processing receipts & deliveries planned by a manager.',
  manager: 'Everything staff can do, plus planning receipts & deliveries, products, settings and users.',
};

function AddUserModal({ onClose, onSaved }) {
  const notify = useToast();
  const form = useForm({ loginId: '', name: '', email: '', role: 'staff', password: '', confirmPassword: '' }, {
    validate: validateSignup, // same rules as self sign-up
    onSubmit: async ({ confirmPassword: _c, ...v }) => {
      const user = await userApi.create(v);
      notify(`${user.name} added as ${user.role === 'manager' ? 'manager' : 'staff'}. Share the temporary password with them.`);
      onSaved();
    },
  });
  return (
    <Modal title="Add team member" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={form.handleSubmit} loading={form.submitting}>Add member</Button></>}>
      <form className="stack" onSubmit={form.handleSubmit} noValidate>
        <Alert>{form.formError}</Alert>
        <Input label="Login ID" required hint="6-12 characters, must be unique" autoFocus {...form.bind('loginId')} />
        <Input label="Full name" required {...form.bind('name')} />
        <Input label="Email" type="email" required {...form.bind('email')} />
        <Select label="Role" options={ROLE_OPTIONS} hint={ROLE_HELP[form.values.role]} {...form.bind('role')} />
        <PasswordInput label="Temporary password" required autoComplete="new-password"
          hint="More than 8 characters with upper case, lower case and a special character" {...form.bind('password')} />
        <PasswordInput label="Re-enter temporary password" required autoComplete="new-password" {...form.bind('confirmPassword')} />
      </form>
    </Modal>
  );
}

/** Managers add staff, change roles and deactivate accounts. Changes apply to the affected user instantly. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const notify = useToast();
  const [q, setQ] = useQueryState({ page: '1' });
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const params = { search: q.search, role: q.role, status: q.status, page: q.page };
  const { data, error, loading, reload } = useFetch(() => userApi.list(params), [JSON.stringify(params)], { live: ['users'] });

  const update = async (u, patch, message) => {
    setBusyId(u.id);
    try {
      await userApi.update(u.id, patch);
      notify(message);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (u) => <><strong>{u.name}</strong>{u.id === me.id && <span className="muted"> (you)</span>}</> },
    { key: 'loginId', header: 'Login ID', render: (u) => <code>{u.loginId}</code> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => (u.id === me.id ? <span className={`role-badge role-${u.role}`}>{u.role}</span> : (
      <select className="input compact" value={u.role} disabled={busyId === u.id || !u.isActive} aria-label={`Role for ${u.name}`}
        onChange={(e) => update(u, { role: e.target.value }, `${u.name} is now ${e.target.value === 'manager' ? 'an Inventory Manager' : 'Warehouse Staff'}`)}>
        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )) },
    { key: 'isActive', header: 'Status', render: (u) => <span className={`badge ${u.isActive ? 'badge-done' : 'badge-canceled'}`}>{u.isActive ? 'active' : 'deactivated'}</span> },
    { key: 'createdAt', header: 'Joined', className: 'nowrap', render: (u) => fmtDate(u.createdAt) },
    { key: 'act', header: '', align: 'right', render: (u) => u.id !== me.id && (
      <Button variant={u.isActive ? 'danger-ghost' : 'ghost'} loading={busyId === u.id}
        onClick={() => (!u.isActive || window.confirm(`Deactivate ${u.name}? They will be signed out immediately.`))
          && update(u, { isActive: !u.isActive }, `${u.name} ${u.isActive ? 'deactivated' : 're-activated'}`)}>
        {u.isActive ? 'Deactivate' : 'Re-activate'}
      </Button>
    ) },
  ];

  return (
    <>
      <PageHeader title="Users" subtitle="Inventory managers and warehouse staff">
        <Button onClick={() => setAdding(true)}>Add member</Button>
      </PageHeader>
      <div className="toolbar">
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search name, login ID or email" />
        <Select placeholder="All roles" value={q.role ?? ''} options={ROLE_OPTIONS} onChange={(e) => setQ({ role: e.target.value })} aria-label="Role" />
        <Select placeholder="Any status" value={q.status ?? ''} onChange={(e) => setQ({ status: e.target.value })} aria-label="Status"
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }]} />
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <DataTable rows={data.data} columns={columns} rowClassName={(u) => (u.isActive ? '' : 'dimmed')}
            emptyTitle="No users match these filters" />
          <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
        </>
      )}
      {adding && <AddUserModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </>
  );
}
