import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/endpoints.js';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Input, PasswordInput } from '../../components/ui.jsx';
import { PasswordRequirements } from '../../components/PasswordRequirements.jsx';
import { EMAIL_RE, passwordProblems } from '../../utils.js';
import { AuthShell } from './AuthShell.jsx';

// Mirrors the server rules so users get instant feedback; the server re-validates regardless.
export function validateSignup(v, step) {
  const e = {};
  if (step === 'form') {
    if (!/^[A-Za-z0-9_.]{6,12}$/.test(v.loginId.trim())) e.loginId = 'Login ID must be 6-12 letters, numbers, "." or "_"';
    if (v.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address';
    const pw = passwordProblems(v.password);
    if (pw.length) e.password = 'invalid';
    if (v.password.length > 72) e.password = 'Password must be at most 72 characters';
    if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match';
  } else {
    if (!/^\d{6}$/.test(v.otp.trim())) e.otp = 'Please enter a valid 6-digit verification code';
  }
  return e;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const notify = useToast();
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [info, setInfo] = useState('');

  const form = useForm({ loginId: '', name: '', email: '', password: '', confirmPassword: '', otp: '' }, {
    validate: (v) => validateSignup(v, step),
    onSubmit: async (v) => {
      if (step === 'form') {
        const res = await authApi.sendSignupOtp({
          loginId: v.loginId.trim(),
          name: v.name.trim(),
          email: v.email.trim().toLowerCase(),
          password: v.password,
          confirmPassword: v.confirmPassword,
        });
        setInfo(res.message || `Verification code sent to ${v.email.trim()}`);
        setStep('otp');
        setHasSubmitted(false);
      } else {
        await authApi.signup({
          loginId: v.loginId.trim(),
          name: v.name.trim(),
          email: v.email.trim().toLowerCase(),
          password: v.password,
          confirmPassword: v.confirmPassword,
          otp: v.otp.trim(),
        });
        notify('Account created successfully. Please sign in.');
        navigate('/login', { state: { loginId: v.loginId.trim() }, replace: true });
      }
    },
  });

  const handleSubmit = (e) => {
    setHasSubmitted(true);
    form.handleSubmit(e);
  };

  const handleResendOtp = async () => {
    try {
      setInfo('Sending new verification code...');
      await authApi.sendSignupOtp({
        loginId: form.values.loginId.trim(),
        name: form.values.name.trim(),
        email: form.values.email.trim().toLowerCase(),
        password: form.values.password,
        confirmPassword: form.values.confirmPassword,
      });
      setInfo(`New verification code sent to ${form.values.email.trim()}`);
      form.set('otp', '');
    } catch (err) {
      setInfo(err.message || 'Failed to resend code');
    }
  };

  const handleEditDetails = () => {
    setStep('form');
    setInfo('');
    setHasSubmitted(false);
    form.set('otp', '');
  };

  const confirmStarted = form.values.confirmPassword.length > 0;
  const passwordsMatch = form.values.password === form.values.confirmPassword;

  return (
    <AuthShell
      title={step === 'form' ? 'Create account' : 'Verify your email'}
      subtitle={
        step === 'form'
          ? 'Set up your StockSense workspace.'
          : `We sent a 6-digit verification code to ${form.values.email}.`
      }
    >
      <form onSubmit={handleSubmit} noValidate className="stack">
        <Alert>{form.formError}</Alert>
        {info && <Alert tone="info">{info}</Alert>}

        {step === 'form' ? (
          <>
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
            <Button type="submit" loading={form.submitting}>Send verification code</Button>
            <p className="auth-links center">Already have an account? <Link to="/login">Sign in</Link></p>
          </>
        ) : (
          <>
            <Input
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit code"
              autoFocus
              {...form.bind('otp')}
            />
            <Button type="submit" loading={form.submitting}>Verify & Create account</Button>
            <div className="auth-links">
              <button type="button" className="link" onClick={handleResendOtp} disabled={form.submitting}>
                Resend code
              </button>
              <button type="button" className="link" onClick={handleEditDetails} disabled={form.submitting}>
                Edit details
              </button>
            </div>
          </>
        )}
      </form>
    </AuthShell>
  );
}

