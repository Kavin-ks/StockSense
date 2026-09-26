import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { Alert, Button, Input, PasswordInput } from '../../components/ui.jsx';
import { PasswordRequirements } from '../../components/PasswordRequirements.jsx';
import { EMAIL_RE, passwordProblems } from '../../utils.js';
import { AuthShell } from './AuthShell.jsx';

// Mirrors the server rules so users get instant feedback; the server re-validates regardless.
export function validateSignup(v) {
  const e = {};
  if (!/^[A-Za-z0-9_.]{6,12}$/.test(v.loginId.trim())) e.loginId = 'Login ID must be 6-12 letters, numbers, "." or "_"';
  if (v.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address';
  const pw = passwordProblems(v.password);
  if (pw.length) e.password = 'invalid';
  if (v.password.length > 72) e.password = 'Password must be at most 72 characters';
  if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match';
  return e;
}

export default function SignupPage() {
  const { signup } = useAuth();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [requested, setRequested] = useState(null); // the pending account, once created
  const form = useForm({ loginId: '', name: '', email: '', password: '', confirmPassword: '' }, {
    validate: validateSignup,
    onSubmit: async (v) => { setRequested((await signup(v)).user); },
  });

  if (requested) {
    return (
      <AuthShell title="Request sent" subtitle="Your account is waiting for approval.">
        <div className="stack">
          <Alert tone="info">
            Thanks, {requested.name}. An inventory manager has been notified and needs to approve your account
            (Login ID <strong>{requested.loginId}</strong>) before you can sign in.
          </Alert>
          <p className="muted small-print">Once approved, sign in with the Login ID and password you just chose.</p>
          <Link className="btn btn-primary" to="/login">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = (e) => {
    setHasSubmitted(true);
    form.handleSubmit(e);
  };

  const confirmStarted = form.values.confirmPassword.length > 0;
  const passwordsMatch = form.values.password === form.values.confirmPassword;

  return (
    <AuthShell title="Create account" subtitle="Set up your StockSense workspace.">
      <form onSubmit={handleSubmit} noValidate className="stack">
        <Alert>{form.formError}</Alert>
        <Input label="Login ID" hint="6-12 characters, must be unique" autoFocus {...form.bind('loginId')} />
        <Input label="Full name" autoComplete="name" {...form.bind('name')} />
        <Input label="Email" type="email" autoComplete="email" {...form.bind('email')} />
        <div>
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            error={form.errors.password && form.errors.password !== 'invalid' ? form.errors.password : null}
            {...form.bind('password')}
          />
          <PasswordRequirements
            password={form.values.password}
            showError={hasSubmitted}
          />
        </div>
        <div>
          <PasswordInput
            label="Re-enter password"
            autoComplete="new-password"
            error={confirmStarted ? null : form.errors.confirmPassword}
            {...form.bind('confirmPassword')}
          />
          {confirmStarted && (
            <div
              className={`confirm-feedback ${passwordsMatch ? 'match' : 'mismatch'}`}
              role="status"
              aria-live="polite"
            >
              <span className="confirm-feedback-icon" aria-hidden="true">
                {passwordsMatch ? '✓' : '✗'}
              </span>
              <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
            </div>
          )}
        </div>
        <Button type="submit" loading={form.submitting}>Sign up</Button>
        <p className="muted center small-print">New accounts start as <strong>Warehouse Staff</strong> and need an inventory manager's approval before you can sign in.</p>
        <p className="auth-links center">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}

