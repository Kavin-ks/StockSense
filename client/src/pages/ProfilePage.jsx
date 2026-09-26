import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Button, Input, PageHeader } from '../components/ui.jsx';
import { EMAIL_RE, fmtDate } from '../utils.js';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
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
      <div className="stack" style={{ maxWidth: 640 }}>
        <form className="card form-grid" onSubmit={form.handleSubmit} noValidate>
          <h2 className="span-all" style={{ margin: 0 }}>Account Information</h2>
          <div className="span-all"><Alert>{form.formError}</Alert></div>
          <Input label="Full name" {...form.bind('name')} />
          <Input label="Email" type="email" {...form.bind('email')} />
          <div className="span-all"><Button type="submit" loading={form.submitting}>Save profile</Button></div>
        </form>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Appearance</h2>
          <p className="muted" style={{ margin: 0 }}>Choose your preferred color theme or sync automatically with your system settings.</p>
          <div className="segmented">
            <button
              type="button"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              🌙 Dark
            </button>
            <button
              type="button"
              className={theme === 'system' ? 'active' : ''}
              onClick={() => setTheme('system')}
            >
              💻 System ({resolvedTheme})
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
