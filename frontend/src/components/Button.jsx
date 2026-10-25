import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function Button({ variant = 'primary', size = 'md', className, type = 'button', block = false, ...props }) {
  const classes = twMerge(clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
    variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
    variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    variant === 'link' && 'text-brand-600 hover:underline dark:text-brand-400',
    size === 'sm' && 'px-3 py-1.5 text-sm',
    size === 'md' && 'px-4 py-2.5 text-sm',
    size === 'lg' && 'px-5 py-3 text-base',
    block && 'w-full',
    className,
  ));
  return <button type={type} className={classes} {...props} />;
}
