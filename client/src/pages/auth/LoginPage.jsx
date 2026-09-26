import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { Alert, Button, Input } from '../../components/ui.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({ loginId: '', password: '' }, {
    validate: (v) => ({
      ...(!v.loginId.trim() && { loginId: 'Login ID is required' }),
      ...(!v.password && { password: 'Password is required' }),
    }),
    onSubmit: async (v) => {
      await login(v);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    },
  });

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Manage your inventory in one place.">
      <form onSubmit={form.handleSubmit} noValidate className="stack">
        <Alert>{form.formError}</Alert>
        <Input label="Login ID" autoComplete="username" autoFocus {...form.bind('loginId')} />
        <Input label="Password" type="password" autoComplete="current-password" {...form.bind('password')} />
        <Button type="submit" loading={form.submitting}>Sign in</Button>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span>New here? <Link to="/signup">Sign up</Link></span>
        </div>
      </form>
    </AuthShell>
  );
}
