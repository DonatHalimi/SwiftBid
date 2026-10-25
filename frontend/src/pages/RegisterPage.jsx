import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gavel, MailCheck, UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import { ErrorNotice, SuccessNotice } from '../components/Notice.jsx';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
    email: z.string().trim().email('Enter a valid email address.'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(72, 'Use no more than 72 characters.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export default function RegisterPage() {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(values) {
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/register', {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      setEmail(values.email);
      setSuccess(true);
      setCooldown(60);
    } catch (requestError) {
      if (requestError.code === 'EMAIL_DELIVERY_FAILED') {
        setEmail(values.email);
        setSuccess(true);
        setCooldown(60);
      }
      setError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function resendVerification() {
    setResendPending(true);
    setResendMessage('');
    setError(null);
    try {
      await api.post('/auth/resend-verification', { email });
      setResendMessage('If your account still needs verification and the resend cooldown has passed, another email will be sent.');
      setCooldown(60);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setResendPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
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
          <h1 className="mt-7 text-3xl font-black">Join the auction.</h1>
          <p className="mt-3 leading-7 text-slate-200">
            Create an account to bid live, make instant offers, and track every
            purchase in one place.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-200">
            <li>· Bid on unique listings in real time</li>
            <li>· Make instant offers when you&apos;re ready to buy</li>
            <li>· Enable seller tools whenever you want</li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          Ankand · Live auctions and instant offers
        </p>
      </div>

      <div className="p-6 sm:p-9">
        {success ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">
              <MailCheck size={24} />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error?.code === 'EMAIL_DELIVERY_FAILED'
                ? <>Your account was created, but we could not send the verification email to <strong className="text-slate-800 dark:text-slate-200">{email}</strong>.</>
                : <>We sent a verification link to <strong className="text-slate-800 dark:text-slate-200">{email}</strong>. Open it within 24 hours to verify your email and sign in automatically.</>}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Check your spam or junk folder if it is not there. You can request another email
              {cooldown > 0 ? ` in ${cooldown} seconds.` : '.'}
            </p>
            <ErrorNotice error={error} className="mt-4" />
            {resendMessage && <SuccessNotice className="mt-4">{resendMessage}</SuccessNotice>}
            <Button
              className="mt-5 w-full"
              disabled={resendPending || cooldown > 0}
              onClick={resendVerification}
            >
              {resendPending ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
            </Button>
            <p className="mt-5 text-sm text-slate-500">
              Already verified?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="mt-2 text-sm text-slate-500">
              Registration creates a buyer account. You can enable seller tools later.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)}>
              <ErrorNotice error={error} />
              <Field label="Full name" autoComplete="name" placeholder="Your name" {...register('fullName')} error={errors.fullName?.message} />
              <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} error={errors.email?.message} />
              <Field
                label="Password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 10 characters"
                {...register('password')}
                error={errors.password?.message}
                hint="Use a unique password that you do not use elsewhere."
              />
              <Field label="Confirm password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Creating account…' : <><UserPlus size={16} /> Create account</>}
              </Button>
            </form>
            <p className="mt-5 text-sm text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
