import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export function ErrorNotice({ error, className = '' }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message || 'Something went wrong.';
  return <div role="alert" className={`flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200 ${className}`}><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{message}</span></div>;
}

export function SuccessNotice({ children, className = '' }) {
  return <div role="status" className={`flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 ${className}`}><CheckCircle2 size={18} className="mt-0.5 shrink-0" /><span>{children}</span></div>;
}

export function InfoNotice({ children, className = '' }) {
  return <div className={`flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${className}`}><Info size={18} className="mt-0.5 shrink-0" /><span>{children}</span></div>;
}
