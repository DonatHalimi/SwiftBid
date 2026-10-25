import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Button from '../components/Button.jsx';
import Select from '../components/Select.jsx';
import ProductCard from '../components/ProductCard.jsx';
import LoadingState from '../components/LoadingState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ErrorNotice } from '../components/Notice.jsx';

const sortOptions = [
  { value: 'endingSoon', label: 'Ending soon' },
  { value: 'newest', label: 'Recently listed' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('endingSoon');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', { q: query, sort, page }],
    queryFn: () =>
      api.get(
        `/products?q=${encodeURIComponent(query)}&sort=${sort}&page=${page}&limit=12`
      ),
  });

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10 lg:px-14 lg:py-16">
        <div className="absolute -right-12 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-slate-200">
            <Zap size={14} /> REAL-TIME MARKETPLACE
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            The next bid could be <span className="text-brand-400">yours.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Discover unique listings, compete live, or confirm an instant offer
            when you are ready to buy.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#listings">
              <Button size="lg">
                Explore listings <ArrowRight size={17} />
              </Button>
            </a>
            <Link to="/register">
              <Button
                variant="secondary"
                size="lg"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Join Ankand
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} /> Secure account sessions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap size={15} /> Live bid updates
            </span>
            <span>Instant offers settle immediately</span>
          </div>
        </div>
      </section>

      <section id="listings" className="space-y-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Browse marketplace
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              Active auctions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Bid before the timer ends or make an instant offer on eligible
              listings.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="field pl-9"
                placeholder="Search listings"
                aria-label="Search listings"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              id="product-sort"
              value={sort}
              onChange={(value) => {
                setSort(value);
                setPage(1);
              }}
              options={sortOptions}
              className="w-full sm:w-44"
            />
          </div>
        </div>

        <ErrorNotice error={error} />

        {isLoading ? (
          <LoadingState label="Loading active listings…" />
        ) : data?.items?.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {data.pagination.total} listings · page {page} of{' '}
                {Math.max(1, data.pagination.pages)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage((n) => Math.min(data.pagination.pages, n + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No active listings found"
            message="Try a different search, or check back when sellers post new items."
          />
        )}
      </section>
    </div>
  );
}