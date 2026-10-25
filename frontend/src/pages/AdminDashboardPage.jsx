import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Ban, CheckCircle2, ClipboardList, FileWarning, RefreshCw, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import { api, imageUrl, API_ORIGIN } from '../lib/api.js';
import { io } from 'socket.io-client';
import { formatDate, formatEUR, titleCase } from '../lib/format.js';
import Button from '../components/Button.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingState from '../components/LoadingState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ErrorNotice, SuccessNotice } from '../components/Notice.jsx';

const tabs = [{ id: 'overview', label: 'Overview', icon: Activity }, { id: 'users', label: 'Users', icon: Users }, { id: 'listings', label: 'Listings', icon: ShoppingBag }, { id: 'reports', label: 'Reports', icon: FileWarning }, { id: 'transactions', label: 'Transactions', icon: ClipboardList }, { id: 'logs', label: 'Audit log', icon: ShieldCheck }];

function useAdminList(tab) {
  return useQuery({
    queryKey: ['admin', tab],
    queryFn: () => tab === 'users' ? api.get('/admin/users?limit=50')
      : tab === 'listings' ? api.get('/admin/listings?limit=50')
        : tab === 'reports' ? api.get('/admin/reports?limit=50')
          : tab === 'transactions' ? api.get('/admin/transactions?limit=50')
            : api.get('/admin/audit-logs?limit=50'),
    enabled: tab !== 'overview', refetchInterval: tab === 'logs' ? 5_000 : undefined,
  });
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('overview');
  const [notice, setNotice] = useState(null);
  const queryClient = useQueryClient();
  const metricsQuery = useQuery({ queryKey: ['admin', 'metrics'], queryFn: () => api.get('/admin/metrics'), refetchInterval: 30_000 });
  const listQuery = useAdminList(tab);
  const action = useMutation({
    mutationFn: async ({ type, id, value, imageId }) => {
      if (type === 'user') return api.patch(`/admin/users/${id}`, value);
      if (type === 'cancelListing') return api.post(`/admin/listings/${id}/cancel`);
      if (type === 'removeImage') return api.delete(`/admin/images/${imageId}`);
      if (type === 'review') return api.patch(`/admin/reports/${id}`, { status: value });
      if (type === 'transaction') return api.patch(`/admin/transactions/${id}`, { status: value });
      throw new Error('Unknown administrative action.');
    },
    onSuccess: async () => { setNotice({ kind: 'success', message: 'Administrative action completed.' }); await queryClient.invalidateQueries({ queryKey: ['admin'] }); await queryClient.invalidateQueries({ queryKey: ['products'] }); },
    onError: (error) => setNotice({ kind: 'error', message: error.message }),
  });
  function run(input) { if (window.confirm(input.confirm || 'Apply this administrative action?')) { setNotice(null); action.mutate(input); } }
  const metrics = metricsQuery.data?.metrics;

  useEffect(() => {
    if (tab !== 'logs') return undefined;
    const socket = io(API_ORIGIN, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('admin:join', (result) => { if (!result?.ok) socket.disconnect(); }));
    socket.on('audit:new', () => queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] }));
    socket.on('platform:event', () => queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] }));
    return () => socket.disconnect();
  }, [tab, queryClient]);

  return <div className="space-y-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Control center</p><h1 className="mt-1 text-3xl font-black">Administration</h1><p className="mt-2 text-sm text-slate-500">Moderate listings, manage users, and inspect fulfillment and audit history.</p></div><Button variant="secondary" onClick={() => { queryClient.invalidateQueries({ queryKey: ['admin'] }); }}><RefreshCw size={15} /> Refresh</Button></div>
    {notice && (notice.kind === 'success' ? <SuccessNotice>{notice.message}</SuccessNotice> : <ErrorNotice error={notice.message} />)}
    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-slate-800">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Icon size={15} />{label}</button>)}</div>
    {tab === 'overview' ? metricsQuery.isLoading ? <LoadingState /> : metricsQuery.error ? <ErrorNotice error={metricsQuery.error} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[
      ['Gross merchandise value', formatEUR(metrics?.grossMerchandiseValue), 'Confirmed paid, shipped, and completed orders'],
      ['Active listings', metrics?.activeListings ?? 0, 'Auctions currently open'],
      ['Registered users', metrics?.users ?? 0, 'All user accounts'],
      ['Total listings', metrics?.listings ?? 0, 'Across all listing states'],
      ['Transactions', metrics?.transactions ?? 0, 'Order records created'],
      ['Open reports', metrics?.openReports ?? 0, 'Require moderator review'],
    ].map(([label, value, hint]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>)}</div>
      : listQuery.isLoading ? <LoadingState label={`Loading ${tab}…`} /> : listQuery.error ? <ErrorNotice error={listQuery.error} /> : !listQuery.data?.items?.length ? <EmptyState title={`No ${tab} found`} message="There are no records matching this view." /> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {tab === 'users' && <table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>State</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{listQuery.data.items.map((item) => <tr key={item.id}><td><p className="font-semibold">{item.fullName}</p><p className="text-xs text-slate-500">{item.email}</p><p className="mt-1 text-xs text-slate-500">{item._count.products} listings · {item._count.bids} bids</p></td><td><StatusBadge status={item.role} /></td><td>{item.isSuspended ? <StatusBadge status="CANCELLED" /> : <StatusBadge status="ACTIVE" />}</td><td>{formatDate(item.createdAt, false)}</td><td><div className="flex flex-wrap gap-2">{item.role !== 'ADMIN' && <select className="field min-w-28 py-1.5 text-xs" aria-label={`Change role for ${item.fullName}`} value={item.role} onChange={(event) => run({ type: 'user', id: item.id, value: { role: event.target.value }, confirm: `Change ${item.fullName}'s role to ${event.target.value}?` })}><option value="BUYER">Buyer</option><option value="SELLER">Seller</option></select>}<Button size="sm" variant={item.isSuspended ? 'secondary' : 'danger'} onClick={() => run({ type: 'user', id: item.id, value: { isSuspended: !item.isSuspended }, confirm: `${item.isSuspended ? 'Restore' : 'Suspend'} ${item.fullName}?` })}><Ban size={13} />{item.isSuspended ? 'Restore' : 'Suspend'}</Button></div></td></tr>)}</tbody></table>}
        {tab === 'listings' && <table className="admin-table"><thead><tr><th>Listing</th><th>Seller</th><th>Status</th><th>Reports / bids</th><th>Actions</th></tr></thead><tbody>{listQuery.data.items.map((item) => <tr key={item.id}><td><div className="flex min-w-52 items-center gap-3">{item.images?.[0] ? <img src={imageUrl(item.images[0].url)} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800" />}<div><a href={`/products/${item.id}`} className="font-semibold hover:text-brand-600">{item.title}</a><p className="text-xs text-slate-500">{formatEUR(item.currentHighestBid > 0 ? item.currentHighestBid : item.startingPrice)}</p></div></div></td><td>{item.seller.fullName}<p className="text-xs text-slate-500">{item.seller.email}</p></td><td><StatusBadge status={item.status} /></td><td>{item._count.reports} reports · {item._count.bids} bids</td><td><div className="flex gap-2">{item.status === 'ACTIVE' && <Button size="sm" variant="danger" onClick={() => run({ type: 'cancelListing', id: item.id, confirm: `Force-cancel “${item.title}”?` })}>Cancel</Button>}{item.images?.[0] && <Button size="sm" variant="secondary" onClick={() => run({ type: 'removeImage', imageId: item.images[0].id, confirm: `Remove the first image from “${item.title}”?` })}>Remove image</Button>}</div></td></tr>)}</tbody></table>}
        {tab === 'reports' && <table className="admin-table"><thead><tr><th>Listing / reason</th><th>Reporter</th><th>Reported</th><th>Status</th><th>Actions</th></tr></thead><tbody>{listQuery.data.items.map((item) => <tr key={item.id}><td><p className="font-semibold">{item.product.title}</p><p className="mt-1 max-w-sm whitespace-pre-wrap text-sm text-slate-500">{item.reason}</p><p className="mt-1 text-xs text-slate-500">Seller: {item.product.seller.fullName}</p></td><td>{item.reporter.fullName}<p className="text-xs text-slate-500">{item.reporter.email}</p></td><td>{formatDate(item.createdAt)}</td><td><StatusBadge status={item.status} /></td><td>{item.status === 'OPEN' && <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => run({ type: 'review', id: item.id, value: 'RESOLVED', confirm: 'Mark this report resolved?' })}><CheckCircle2 size={13} />Resolve</Button><Button size="sm" variant="secondary" onClick={() => run({ type: 'review', id: item.id, value: 'DISMISSED', confirm: 'Dismiss this report?' })}>Dismiss</Button>{item.product.status === 'ACTIVE' && <Button size="sm" variant="danger" onClick={() => run({ type: 'cancelListing', id: item.product.id, confirm: `Cancel reported listing “${item.product.title}”?` })}>Cancel listing</Button>}</div>}</td></tr>)}</tbody></table>}
        {tab === 'transactions' && <table className="admin-table"><thead><tr><th>Product / order</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Update</th></tr></thead><tbody>{listQuery.data.items.map((item) => <tr key={item.id}><td><p className="font-semibold">{item.product.title}</p><p className="mt-1 break-all text-xs text-slate-500">{item.id}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p></td><td>{item.buyer.fullName}<p className="text-xs text-slate-500">{item.buyer.email}</p></td><td>{item.seller.fullName}<p className="text-xs text-slate-500">{item.seller.email}</p></td><td className="font-semibold">{formatEUR(item.finalAmount)}</td><td><StatusBadge status={item.status} /></td><td>{({ PENDING_PAYMENT: <Button size="sm" onClick={() => run({ type: 'transaction', id: item.id, value: 'PAID', confirm: 'Mark payment as received? Use only after verifying payment outside the app.' })}>Mark paid</Button>, PAID: <Button size="sm" onClick={() => run({ type: 'transaction', id: item.id, value: 'SHIPPED' })}>Mark shipped</Button>, SHIPPED: <Button size="sm" onClick={() => run({ type: 'transaction', id: item.id, value: 'COMPLETED' })}>Complete</Button> })[item.status] || <span className="text-xs text-slate-500">No transition</span>}</td></tr>)}</tbody></table>}
        {tab === 'logs' && <table className="admin-table"><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Metadata</th><th>IP</th></tr></thead><tbody>{listQuery.data.items.map((item) => <tr key={item.id}><td>{formatDate(item.createdAt)}</td><td>{item.actor?.fullName || 'System / deleted user'}</td><td><span className="font-semibold">{titleCase(item.action)}</span></td><td>{item.targetType}<p className="break-all text-xs text-slate-500">{item.targetId || '—'}</p></td><td><pre className="max-w-xs whitespace-pre-wrap break-words text-xs">{item.metadata ? JSON.stringify(item.metadata) : '—'}</pre></td><td>{item.ipAddress || '—'}</td></tr>)}</tbody></table>}
      </div>}
    <p className="text-xs text-slate-500">Audit log refreshes every 5 seconds. Admin actions are recorded with the acting user, target, metadata, timestamp, and request IP where available.</p>
  </div>;
}
