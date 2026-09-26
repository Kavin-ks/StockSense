import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/endpoints.js';
import { useForm } from '../../hooks/useForm.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Input } from '../../components/ui.jsx';
import { EMAIL_RE, passwordProblems } from '../../utils.js';
import { AuthShell } from './AuthShell.jsx';

/** Two steps: request an OTP by email, then submit OTP + new password. */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request');
  const [info, setInfo] = useState('');
  const navigate = useNavigate();
  const notify = useToast();

  const form = useForm({ email: '', otp: '', password: '', confirmPassword: '' }, {
    validate: (v) => {
      const e = {};
      if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address';
      if (step === 'reset') {
        if (!/^\d{6}$/.test(v.otp.trim())) e.otp = 'OTP must be 6 digits';
        const pw = passwordProblems(v.password);
        if (pw.length) e.password = `Password needs ${pw.join(', ')}`;
        if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match';
      }
      return e;
    },
    onSubmit: async (v) => {
      if (step === 'request') {
        const res = await authApi.forgotPassword({ email: v.email });
        setInfo(res.message);
        setStep('reset');
      } else {
        await authApi.resetPassword(v);
        notify('Password updated. Please sign in.');
        navigate('/login');
      }
    },
  });

  return (
    <AuthShell title="Reset password" subtitle={step === 'request' ? 'We will email you a 6-digit code.' : 'Enter the code and choose a new password.'}>
      <form onSubmit={form.handleSubmit} noValidate className="stack">
        <Alert>{form.formError}</Alert>
        <Alert tone="info">{info}</Alert>
        <Input label="Email" type="email" disabled={step === 'reset'} {...form.bind('email')} />
        {step === 'reset' && (
          <>
            <Input label="OTP" inputMode="numeric" maxLength={6} autoFocus {...form.bind('otp')} />
            <Input label="New password" type="password" autoComplete="new-password" {...form.bind('password')} />
            <Input label="Re-enter new password" type="password" autoComplete="new-password" {...form.bind('confirmPassword')} />
          </>
        )}
        <Button type="submit" loading={form.submitting}>{step === 'request' ? 'Send OTP' : 'Update password'}</Button>
        <div className="auth-links">
          {step === 'reset' && <button type="button" className="link" onClick={() => { setStep('request'); setInfo(''); }}>Resend code</button>}
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
