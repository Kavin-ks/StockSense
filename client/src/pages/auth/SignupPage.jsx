import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { Alert, Button, Input } from '../../components/ui.jsx';
import { EMAIL_RE, passwordProblems } from '../../utils.js';
import { AuthShell } from './AuthShell.jsx';

// Mirrors the server rules so users get instant feedback; the server re-validates regardless.
export function validateSignup(v) {
  const e = {};
  if (!/^[A-Za-z0-9_.]{6,12}$/.test(v.loginId.trim())) e.loginId = 'Login ID must be 6-12 letters, numbers, "." or "_"';
  if (v.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address';
  const pw = passwordProblems(v.password);
  if (pw.length) e.password = `Password needs ${pw.join(', ')}`;
  if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match';
  return e;
}

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ loginId: '', name: '', email: '', password: '', confirmPassword: '' }, {
    validate: validateSignup,
    onSubmit: async (v) => { await signup(v); navigate('/', { replace: true }); },
  });

  return (
    <AuthShell title="Create account" subtitle="Set up your StockSense workspace.">
      <form onSubmit={form.handleSubmit} noValidate className="stack">
        <Alert>{form.formError}</Alert>
        <Input label="Login ID" hint="6-12 characters, must be unique" autoFocus {...form.bind('loginId')} />
        <Input label="Full name" autoComplete="name" {...form.bind('name')} />
        <Input label="Email" type="email" autoComplete="email" {...form.bind('email')} />
        <Input label="Password" type="password" autoComplete="new-password"
          hint="More than 8 characters with upper case, lower case and a special character" {...form.bind('password')} />
        <Input label="Re-enter password" type="password" autoComplete="new-password" {...form.bind('confirmPassword')} />
        <Button type="submit" loading={form.submitting}>Sign up</Button>
        <p className="auth-links center">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
