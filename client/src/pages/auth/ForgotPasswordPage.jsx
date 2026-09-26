import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/endpoints.js';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Input, PasswordInput } from '../../components/ui.jsx';
import { PasswordRequirements } from '../../components/PasswordRequirements.jsx';
import { EMAIL_RE, passwordProblems } from '../../utils.js';
import { AuthShell } from './AuthShell.jsx';

/** Two steps: request an OTP by email, then submit OTP + new password. */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request');
  const [info, setInfo] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const navigate = useNavigate();
  const notify = useToast();

  const form = useForm({ email: '', otp: '', password: '', confirmPassword: '' }, {
    validate: (v) => {
      const e = {};
      if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address';
      if (step === 'reset') {
        if (!/^\d{6}$/.test(v.otp.trim())) e.otp = 'OTP must be 6 digits';
        const pw = passwordProblems(v.password);
        if (pw.length) e.password = 'invalid';
        if (v.password.length > 72) e.password = 'Password must be at most 72 characters';
        if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match';
      }
      return e;
    },
    onSubmit: async (v) => {
      if (step === 'request') {
        const res = await authApi.forgotPassword({ email: v.email.trim().toLowerCase() });
        setInfo(res.message);
        setStep('reset');
        setHasSubmitted(false);
      } else {
        await authApi.resetPassword({
          email: v.email.trim().toLowerCase(),
          otp: v.otp.trim(),
          password: v.password,
          confirmPassword: v.confirmPassword,
        });
        notify('Password updated. Please sign in.');
        navigate('/login', { state: { loginId: v.email.trim().toLowerCase() } });
      }
    },
  });

  const handleSubmit = (e) => {
    if (step === 'reset') {
      setHasSubmitted(true);
    }
    form.handleSubmit(e);
  };

  const handleResend = async () => {
    try {
      setInfo('Sending new verification code...');
      const res = await authApi.forgotPassword({ email: form.values.email.trim().toLowerCase() });
      setInfo(res.message || 'A new verification code has been sent to your email.');
      form.set('otp', '');
    } catch (err) {
      setInfo(err.message || 'Failed to resend code');
    }
  };

  const handleEditEmail = () => {
    setStep('request');
    setInfo('');
    setHasSubmitted(false);
    form.set('otp', '');
  };

  const confirmStarted = form.values.confirmPassword.length > 0;
  const passwordsMatch = form.values.password === form.values.confirmPassword;

  return (
    <AuthShell title="Reset password" subtitle={step === 'request' ? 'We will email you a 6-digit code.' : 'Enter the code and choose a new password.'}>
      <form onSubmit={handleSubmit} noValidate className="stack">
        <Alert>{form.formError}</Alert>
        <Alert tone="info">{info}</Alert>
        <Input label="Email" type="email" disabled={step === 'reset'} {...form.bind('email')} />
        {step === 'reset' && (
          <>
            <Input label="OTP" inputMode="numeric" maxLength={6} autoFocus {...form.bind('otp')} />
            <div>
              <PasswordInput
                label="New password"
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
                label="Re-enter new password"
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
          </>
        )}
        <Button type="submit" loading={form.submitting}>{step === 'request' ? 'Send OTP' : 'Update password'}</Button>
        <div className="auth-links">
          {step === 'reset' && (
            <>
              <button
                type="button"
                className="link"
                onClick={handleResend}
                disabled={form.submitting}
              >
                Resend code
              </button>
              <button
                type="button"
                className="link"
                onClick={handleEditEmail}
                disabled={form.submitting}
              >
                Change email
              </button>
            </>
          )}
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
