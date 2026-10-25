import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import { ErrorNotice, SuccessNotice } from '../components/Notice.jsx';

export default function VerifyEmailPage() {
  const { verifyEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const submittedToken = useRef(null);
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token');
    if (!token) {
      setError({ message: 'This verification link is missing its token. Request a new email to continue.' });
      setStatus('failed');
      return;
    }
    if (submittedToken.current === token) return;
    submittedToken.current = token;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);

    verifyEmail(token)
      .then((user) => navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard', { replace: true }))
      .catch((verificationError) => {
        setError(verificationError);
        setStatus('failed');
      });
  }, [location.search, navigate, verifyEmail]);

  async function resend(event) {
    event.preventDefault();
    setResending(true);
    setError(null);
    setResendMessage('');
    try {
      await api.post('/auth/resend-verification', { email });
      setResendMessage('If your account still needs verification and the resend cooldown has passed, another email will be sent.');
    } catch (resendError) {
      setError(resendError);
    } finally {
      setResending(false);
    }
  }

  const alreadyUsed = error?.code === 'EMAIL_VERIFICATION_USED';

  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">
        <MailCheck size={24} />
      </div>
      {status === 'verifying' ? (
        <>
          <h1 className="mt-5 text-2xl font-bold">Verifying your email…</h1>
          <p className="mt-2 text-sm text-slate-500">Please wait while we securely confirm your account.</p>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-2xl font-bold">
            {alreadyUsed ? 'This link has already been used' : 'We could not verify this link'}
          </h1>
          <ErrorNotice error={error} className="mt-4" />
          {alreadyUsed ? (
            <p className="mt-5 text-sm text-slate-500">
              Your email may already be verified.{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link> to continue.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Verification links expire after 24 hours and can only be used once. Enter your account email to request a fresh link.
              </p>
              <form className="mt-5 space-y-4" onSubmit={resend}>
                <Field label="Email address" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                {resendMessage && <SuccessNotice>{resendMessage}</SuccessNotice>}
                <Button type="submit" className="w-full" disabled={resending || !email}>
                  {resending ? 'Sending…' : 'Send a new verification email'}
                </Button>
              </form>
            </>
          )}
        </>
      )}
    </section>
  );
}
