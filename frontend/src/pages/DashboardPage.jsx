import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Gavel,
  PlusCircle,
  Store,
  UserRound,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDate, formatEUR, titleCase } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/Button.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingState from '../components/LoadingState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ErrorNotice, InfoNotice, SuccessNotice } from '../components/Notice.jsx';

const tabs = [
  { id: 'bids', label: 'My bids', icon: Gavel },
  { id: 'offers', label: 'Offers', icon: CircleDollarSign },
  { id: 'listings', label: 'My listings', icon: Store },
  { id: 'purchases', label: 'Purchases', icon: BadgeCheck },
  { id: 'sales', label: 'Sales', icon: UserRound },
];

const tabVariants = {
  enter: (direction) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -24 : 24 }),
};

function ItemLink({ product }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="font-semibold hover:text-brand-600"
    >
      {product.title}
    </Link>
  );
}

function OrderActions({ item, onStatus }) {
  if (item.status === 'PAID') {
    return (
      <Button size="sm" onClick={() => onStatus(item.id, 'SHIPPED')}>
        Mark shipped
      </Button>
    );
  }
  if (item.status === 'SHIPPED') {
    return (
      <Button size="sm" onClick={() => onStatus(item.id, 'COMPLETED')}>
        Confirm received
      </Button>
    );
  }
  return null;
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('bids');
  const [direction, setDirection] = useState(0);
  const [actionError, setActionError] = useState(null);
  const [message, setMessage] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'me'],
    queryFn: () => api.get('/dashboard/me'),
  });

  const becomeSellerMutation = useMutation({
    mutationFn: () => api.post('/auth/become-seller'),
    onSuccess: async () => {
      await refreshUser();
      setMessage('Seller tools are now enabled.');
    },
    onError: setActionError,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/transactions/${id}/status`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setMessage('Order status updated.');
    },
    onError: setActionError,
  });

  function changeStatus(id, status) {
    setActionError(null);
    setMessage(null);
    statusMutation.mutate({ id, status });
  }

  function switchTab(nextId) {
    if (nextId === tab) return;
    const currentIndex = tabs.findIndex((t) => t.id === tab);
    const nextIndex = tabs.findIndex((t) => t.id === nextId);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setTab(nextId);
  }

  const activeListings =
    data?.listings?.filter((item) => item.status === 'ACTIVE').length ?? 0;
  const activeBids =
    data?.bids?.filter((item) => item.product?.status === 'ACTIVE').length ?? 0;
  const canSell = user?.role === 'SELLER' || user?.role === 'ADMIN';

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            Account
          </p>
          <h1 className="mt-1 text-3xl font-black">Your dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">
            Welcome back, {user?.fullName}. Manage bids, listings, and order
            handoffs here.
          </p>
        </div>
        {canSell && (
          <Link to="/sell">
            <Button>
              <PlusCircle size={16} /> Create listing
            </Button>
          </Link>
        )}
      </div>

      {actionError && <ErrorNotice error={actionError} />}
      {message && <SuccessNotice>{message}</SuccessNotice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Active bids</p>
          <p className="mt-1 text-3xl font-black">{activeBids}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Active listings</p>
          <p className="mt-1 text-3xl font-black">{activeListings}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Account role</p>
          <p className="mt-1 text-2xl font-black">{titleCase(user?.role)}</p>
          {user?.role === 'BUYER' && (
            <button
              type="button"
              onClick={() => becomeSellerMutation.mutate()}
              disabled={becomeSellerMutation.isPending}
              className="mt-2 text-sm font-semibold text-brand-600 hover:underline"
            >
              {becomeSellerMutation.isPending ? 'Enabling…' : 'Enable seller tools'}{' '}
              <ArrowRight size={14} className="inline" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = tab === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => switchTab(id)}
                className={`relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive
                    ? 'text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="dashboard-tab-indicator"
                    className="absolute inset-0 rounded-lg bg-brand-600"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <motion.span
                    animate={{ scale: isActive ? 1.15 : 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="inline-flex"
                  >
                    <Icon size={15} />
                  </motion.span>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Loading your activity…" />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : (
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={tab}
              custom={direction}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-3"
            >
              {tab === 'bids' &&
                (data.bids.length ? (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {data.bids.map((bid) => (
                      <div
                        key={bid.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <ItemLink product={bid.product} />
                          <p className="mt-1 text-xs text-slate-500">
                            Bid {formatEUR(bid.amount)} ·{' '}
                            {formatDate(bid.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={bid.product.status} />
                        <p className="font-bold">
                          Current: {formatEUR(bid.product.currentHighestBid)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No bids yet"
                    message="Open an active listing and submit your first bid."
                    action={
                      <Link to="/">
                        <Button>Explore auctions</Button>
                      </Link>
                    }
                  />
                ))}

              {tab === 'offers' &&
                (data.offers.length ? (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {data.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <ItemLink product={offer.product} />
                          <p className="mt-1 text-xs text-slate-500">
                            Offer {formatEUR(offer.offeredAmount)} ·{' '}
                            {formatDate(offer.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={offer.status} />
                        <StatusBadge status={offer.product.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No offers yet"
                    message="Eligible listings let you make an instant offer to close the deal immediately."
                    action={
                      <Link to="/">
                        <Button>Find listings</Button>
                      </Link>
                    }
                  />
                ))}

              {tab === 'listings' &&
                (data.listings.length ? (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {data.listings.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <ItemLink product={listing} />
                          <p className="mt-1 text-xs text-slate-500">
                            {listing._count.bids} bids · Created{' '}
                            {formatDate(listing.createdAt, false)}
                          </p>
                        </div>
                        <p className="font-bold">
                          {formatEUR(
                            listing.currentHighestBid > 0
                              ? listing.currentHighestBid
                              : listing.startingPrice
                          )}
                        </p>
                        <StatusBadge status={listing.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No listings created"
                    message="Publish your first listing to start selling."
                    action={
                      canSell ? (
                        <Link to="/sell">
                          <Button>Create listing</Button>
                        </Link>
                      ) : (
                        <Button onClick={() => becomeSellerMutation.mutate()}>
                          Enable seller tools
                        </Button>
                      )
                    }
                  />
                ))}

              {(tab === 'purchases' || tab === 'sales') &&
                (() => {
                  const orders =
                    tab === 'purchases' ? data.purchases : data.sales;
                  if (!orders.length) {
                    return (
                      <EmptyState
                        title={
                          tab === 'purchases'
                            ? 'No purchases yet'
                            : 'No sales yet'
                        }
                        message={
                          tab === 'purchases'
                            ? 'Orders created by instant offers or ended auctions will show here.'
                            : 'Your sold listings and order states will show here.'
                        }
                      />
                    );
                  }
                  return (
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <ItemLink product={order.product} />
                            <p className="mt-1 text-xs text-slate-500">
                              {tab === 'purchases'
                                ? `Seller: ${order.seller.fullName}`
                                : `Buyer: ${order.buyer.fullName}`}{' '}
                              · {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <p className="font-bold">
                            {formatEUR(order.finalAmount)}
                          </p>
                          <StatusBadge status={order.status} />
                          {((tab === 'sales' && order.status === 'PAID') ||
                            (tab === 'purchases' &&
                              order.status === 'SHIPPED')) && (
                              <OrderActions item={order} onStatus={changeStatus} />
                            )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <InfoNotice>
        Payment processing and automated seller payouts are not implemented in
        this MVP. Orders start as pending payment; an administrator can mark a
        verified order as paid before shipping workflows continue.
      </InfoNotice>
    </div>
  );
}