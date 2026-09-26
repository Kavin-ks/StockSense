import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { Alert, Button, Field, Input } from '../../components/ui.jsx';
import { EMAIL_RE, passwordProblems } from '../../utils.js';
import { AuthShell } from './AuthShell.jsx';

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function PasswordInput({ label, hint, visible, onToggle, ...bindProps }) {
  const { error, ...inputProps } = bindProps;
  return (
    <Field label={label} error={error} hint={hint}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          className="input"
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          style={{ paddingRight: '40px' }}
          {...inputProps}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: '3px' }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </Field>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          hint="More than 8 characters with upper case, lower case and a special character"
          visible={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
          {...form.bind('password')}
        />
        <PasswordInput
          label="Re-enter password"
          autoComplete="new-password"
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((v) => !v)}
          {...form.bind('confirmPassword')}
        />
        <Button type="submit" loading={form.submitting}>Sign up</Button>
        <p className="auth-links center">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}

