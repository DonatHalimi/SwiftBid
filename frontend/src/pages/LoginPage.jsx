import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gavel, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import { ErrorNotice, SuccessNotice } from '../components/Notice.jsx';
import { api } from '../lib/api.js';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(values) {
    setPending(true);
    setError(null);
    setUnverifiedEmail('');
    setResendMessage('');
    try {
      const signedIn = await login(values);
      const destination =
        location.state?.from?.pathname ||
        (signedIn.role === 'ADMIN' ? '/admin' : '/dashboard');
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err);
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(values.email);
    } finally {
      setPending(false);
    }
  }

  async function resendVerification() {
    setResendPending(true);
    setResendMessage('');
    try {
      await api.post('/auth/resend-verification', { email: unverifiedEmail });
      setResendMessage('If your account still needs verification and the resend cooldown has passed, another email will be sent.');
    } catch (err) {
      setError(err);
    } finally {
      setResendPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
      {/* Left photo panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-9 text-white md:flex">
        <img
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/60 to-brand-700/50" />

        <div className="relative">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
            <Gavel size={21} />
          </div>
          <h1 className="mt-7 text-3xl font-black">Welcome back.</h1>
          <p className="mt-3 leading-7 text-slate-200">
            Track your bids, manage your listings, and finish purchases from one
            dashboard.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">
          Ankand · Live auctions and instant offers
        </p>
      </div>

      {/* Right form */}
      <div className="p-6 sm:p-9">
        <h2 className="text-2xl font-bold">Sign in</h2>
        <p className="mt-2 text-sm text-slate-500">
          Use your Ankand account credentials.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)}>
          <ErrorNotice error={error} />
          {unverifiedEmail && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">Verify your email before signing in.</p>
              {resendMessage && <SuccessNotice>{resendMessage}</SuccessNotice>}
              <Button type="button" variant="secondary" className="w-full" disabled={resendPending} onClick={resendVerification}>
                {resendPending ? 'Sending…' : 'Resend verification email'}
              </Button>
            </div>
          )}
          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register('email')}
            error={errors.email?.message}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={pending}
          >
            {pending ? (
              'Signing in…'
            ) : (
              <>
                <LogIn size={16} /> Sign in
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-sm text-slate-500">
          New to Ankand?{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-600 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}