import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Button, Input, PageHeader } from '../components/ui.jsx';
import { EMAIL_RE, fmtDate } from '../utils.js';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const notify = useToast();
  const form = useForm({ name: user.name, email: user.email }, {
    validate: (v) => ({
      ...(v.name.trim().length < 2 && { name: 'Name must be at least 2 characters' }),
      ...(!EMAIL_RE.test(v.email.trim()) && { email: 'Please enter a valid email address' }),
    }),
    onSubmit: async (v) => { await updateProfile(v); notify('Profile updated'); },
  });
  return (
    <>
      <PageHeader title="My Profile" subtitle={`Login ID ${user.loginId} · ${user.role} · member since ${fmtDate(user.createdAt)}`} />
      <form className="card form-grid narrow" onSubmit={form.handleSubmit} noValidate>
        <div className="span-all"><Alert>{form.formError}</Alert></div>
        <Input label="Full name" {...form.bind('name')} />
        <Input label="Email" type="email" {...form.bind('email')} />
        <div className="span-all"><Button type="submit" loading={form.submitting}>Save profile</Button></div>
      </form>
    </>
  );
}
