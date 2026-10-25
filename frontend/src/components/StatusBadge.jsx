import { clsx } from 'clsx';
import { titleCase } from '../lib/format.js';

export default function StatusBadge({ status }) {
  const tone = status === 'ACTIVE' || status === 'PAID' || status === 'COMPLETED' || status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    : status === 'PENDING_PAYMENT' || status === 'OPEN' || status === 'SHIPPED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
      : status === 'SOLD' || status === 'ACCEPTED' ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return <span className={clsx('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>{titleCase(status)}</span>;
}
