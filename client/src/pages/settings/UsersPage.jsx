import { useState } from 'react';
import { Trash2, UserCheck, UserX } from 'lucide-react';
import { userApi } from '../../api/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useForm } from '../../hooks/useForm.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { DataTable } from '../../components/DataTable.jsx';
import { Alert, Button, ErrorState, Input, Modal, PageHeader, Pagination, PasswordInput, SearchInput, Select, Spinner } from '../../components/ui.jsx';
import { validateSignup } from '../auth/SignupPage.jsx';
import { fmtDate, passwordProblems } from '../../utils.js';

const ROLE_OPTIONS = [
  { value: 'staff', label: 'Warehouse Staff' },
  { value: 'manager', label: 'Inventory Manager' },
];
const ROLE_HELP = {
  staff: 'Transfers, counting (adjustments), and processing receipts & deliveries planned by a manager.',
  manager: 'Everything staff can do, plus planning receipts & deliveries, products, settings and users.',
};
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Waiting for approval' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];
const STATUS_BADGE = { pending: 'badge-waiting', active: 'badge-done', deactivated: 'badge-canceled' };

/** Runs a user-admin action with a busy flag, a toast, and a friendly error. */
function useUserAction(onDone) {
  const notify = useToast();
  const [busy, setBusy] = useState(null);
  const run = async (key, fn, message) => {
    setBusy(key);
    try {
      await fn();
      notify(message);
      onDone();
    } catch (err) {
      notify(err.message, 'error');
      onDone(); // someone else may have acted first: show the real state
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function AddUserModal({ onClose, onSaved }) {
  const notify = useToast();
  const form = useForm({ loginId: '', name: '', email: '', role: 'staff', password: '', confirmPassword: '' }, {
    // Same rules as self sign-up (which shows a live checklist, so it only flags the password as 'invalid').
    validate: (v) => {
      const e = validateSignup(v, 'form');
      if (e.password === 'invalid') e.password = `Password needs ${passwordProblems(v.password).join(', ')}`;
      return e;
    },
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
        <p className="muted small-print">Members you add are active immediately (no approval step).</p>
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

/** Sign-ups from the login page wait here until a manager approves (choosing the role) or rejects them. */
function PendingRequests({ onChange }) {
  const { data, reload } = useFetch(() => userApi.list({ status: 'pending', pageSize: 50 }), [], { live: ['users'] });
  const [roles, setRoles] = useState({});
  const { busy, run } = useUserAction(() => { reload(); onChange(); });
  const pending = data?.data ?? [];
  if (!pending.length) return null;

  return (
    <section className="card pending-card">
      <h2>Waiting for approval <span className="count-pill">{pending.length}</span></h2>
      <p className="muted">These people signed up from the login page. They can't sign in until you approve them.</p>
      <ul className="pending-list">
        {pending.map((u) => {
          const role = roles[u.id] ?? 'staff';
          return (
            <li key={u.id}>
              <div>
                <strong>{u.name}</strong> <code>{u.loginId}</code>
                <div className="muted small-print">{u.email} · signed up {fmtDate(u.createdAt)}</div>
              </div>
              <select className="input compact" value={role} aria-label={`Role for ${u.name}`}
                onChange={(e) => setRoles((r) => ({ ...r, [u.id]: e.target.value }))}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button variant="success" loading={busy === `a${u.id}`} disabled={Boolean(busy)}
                onClick={() => run(`a${u.id}`, () => userApi.approve(u.id, { role }), `${u.name} approved as ${role === 'manager' ? 'manager' : 'staff'}`)}>
                <UserCheck size={15} /> Approve
              </Button>
              <Button variant="danger-ghost" loading={busy === `r${u.id}`} disabled={Boolean(busy)}
                onClick={() => window.confirm(`Reject ${u.name}'s sign-up? Their request will be removed.`)
                  && run(`r${u.id}`, () => userApi.reject(u.id), `${u.name}'s sign-up rejected`)}>
                <UserX size={15} /> Reject
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Managers approve sign-ups, add members, change roles and deactivate accounts. Changes apply instantly. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const [q, setQ] = useQueryState({ page: '1' });
  const [adding, setAdding] = useState(false);
  const params = { search: q.search, role: q.role, status: q.status, page: q.page };
  const { data, error, loading, reload } = useFetch(() => userApi.list(params), [JSON.stringify(params)], { live: ['users'] });
  const { busy, run } = useUserAction(reload);

  const columns = [
    { key: 'name', header: 'Name', render: (u) => <><strong>{u.name}</strong>{u.id === me.id && <span className="muted"> (you)</span>}</> },
    { key: 'loginId', header: 'Login ID', render: (u) => <code>{u.loginId}</code> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => (u.id === me.id || u.status !== 'active' ? <span className={`role-badge role-${u.role}`}>{u.role}</span> : (
      <select className="input compact" value={u.role} disabled={busy === u.id} aria-label={`Role for ${u.name}`}
        onChange={(e) => run(u.id, () => userApi.update(u.id, { role: e.target.value }),
          `${u.name} is now ${e.target.value === 'manager' ? 'an Inventory Manager' : 'Warehouse Staff'}`)}>
        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )) },
    { key: 'status', header: 'Status', render: (u) => <span className={`badge ${STATUS_BADGE[u.status]}`}>{u.status === 'pending' ? 'awaiting approval' : u.status}</span> },
    { key: 'createdAt', header: 'Joined', className: 'nowrap', render: (u) => fmtDate(u.approvedAt ?? u.createdAt) },
    { key: 'act', header: '', align: 'right', render: (u) => {
      if (u.id === me.id) return null;
      if (u.status === 'pending') return <span className="muted small-print">Review above</span>;
      const active = u.status === 'active';
      return (
        <div className="row-actions">
          <Button variant="ghost" loading={busy === u.id}
            onClick={() => (!active || window.confirm(`Deactivate ${u.name}? They will be signed out immediately.`))
              && run(u.id, () => userApi.update(u.id, { status: active ? 'deactivated' : 'active' }), `${u.name} ${active ? 'deactivated' : 're-activated'}`)}>
            {active ? 'Deactivate' : 'Re-activate'}
          </Button>
          <Button variant="danger-ghost" aria-label={`Delete ${u.name}`} disabled={Boolean(busy)}
            onClick={() => window.confirm(
              `Delete ${u.name}?\n\nTheir login is removed and they are signed out everywhere. `
              + 'Documents and stock moves they made keep their name for the audit trail. This cannot be undone.',
            ) && run(`d${u.id}`, () => userApi.remove(u.id), `${u.name} was deleted`)}>
            <Trash2 size={15} /> Delete
          </Button>
        </div>
      );
    } },
  ];

  return (
    <>
      <PageHeader title="Users" subtitle="Inventory managers and warehouse staff">
        <Button onClick={() => setAdding(true)}>Add member</Button>
      </PageHeader>
      <PendingRequests onChange={reload} />
      <div className="toolbar">
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search name, login ID or email" />
        <Select placeholder="All roles" value={q.role ?? ''} options={ROLE_OPTIONS} onChange={(e) => setQ({ role: e.target.value })} aria-label="Role" />
        <Select placeholder="Any status" value={q.status ?? ''} options={STATUS_OPTIONS} onChange={(e) => setQ({ status: e.target.value })} aria-label="Status" />
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <DataTable rows={data.data} columns={columns} rowClassName={(u) => (u.status === 'deactivated' ? 'dimmed' : '')}
            emptyTitle="No users match these filters" />
          <Pagination meta={data.meta} onPage={(page) => setQ({ page: String(page) })} />
        </>
      )}
      {adding && <AddUserModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </>
  );
}
