import { PackageOpen } from 'lucide-react';

export default function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <PackageOpen size={34} className="text-slate-400" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
