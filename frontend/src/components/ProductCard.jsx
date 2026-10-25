import { Link } from 'react-router-dom';
import { Clock3, Gavel, ImageOff } from 'lucide-react';
import { formatEUR, timeRemaining } from '../lib/format.js';
import { imageUrl } from '../lib/api.js';
import StatusBadge from './StatusBadge.jsx';

export default function ProductCard({ product }) {
  const image = product.images?.[0]?.url;
  return (
    <Link to={`/products/${product.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {image ? <img src={imageUrl(image)} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageOff size={34} /></div>}
        <div className="absolute left-3 top-3"><StatusBadge status={product.status} /></div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{product.category}</p>
          <h3 className="mt-1 line-clamp-2 min-h-12 font-semibold text-slate-900 dark:text-white">{product.title}</h3>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Current bid</p>
            <p className="text-lg font-bold tabular-nums">{formatEUR(product.currentHighestBid > 0 ? product.currentHighestBid : product.startingPrice)}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="flex items-center justify-end gap-1"><Gavel size={13} />{product._count?.bids ?? 0} bids</p>
            <p className="mt-1 flex items-center justify-end gap-1"><Clock3 size={13} />{product.status === 'ACTIVE' ? timeRemaining(product.auctionEndsAt) : product.status.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
