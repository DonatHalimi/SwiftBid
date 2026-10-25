import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { AlertTriangle, ArrowLeft, Clock3, Gavel, ImageOff, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';
import { api, API_ORIGIN, imageUrl } from '../lib/api.js';
import { formatDate, formatEUR, timeRemaining } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingState from '../components/LoadingState.jsx';
import { ErrorNotice, InfoNotice, SuccessNotice } from '../components/Notice.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [bidAmount, setBidAmount] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerError, setOfferError] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [notice, setNotice] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const productQuery = useQuery({ queryKey: ['product', id], queryFn: () => api.get(`/products/${id}`), refetchInterval: 30_000 });
  const product = productQuery.data?.product;
  const canBuy = user && user.id !== product?.sellerId && ['BUYER', 'SELLER'].includes(user.role);
  const minBid = useMemo(() => Math.max(Number(product?.currentHighestBid || 0), Number(product?.startingPrice || 0)) + 0.01, [product?.currentHighestBid, product?.startingPrice]);
  const minOffer = useMemo(() => Number(product?.currentHighestBid || 0) > 0 ? Math.max(Number(product?.currentHighestBid || 0), Number(product?.startingPrice || 0)) + 0.01 : Number(product?.startingPrice || 0), [product?.currentHighestBid, product?.startingPrice]);

  useEffect(() => {
    if (!id) return undefined;
    const socket = io(API_ORIGIN, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.emit('product:join', id);
    socket.on('bid:new', (bid) => {
      queryClient.setQueryData(['product', id], (previous) => {
        if (!previous?.product) return previous;
        const bids = [bid, ...(previous.product.bids || []).filter((entry) => entry.id !== bid.id)].slice(0, 20);
        return { ...previous, product: { ...previous.product, currentHighestBid: bid.amount, bids, _count: { ...previous.product._count, bids: (previous.product._count?.bids || 0) + 1 } } };
      });
    });
    const closeAuction = (event) => queryClient.setQueryData(['product', id], (previous) => previous?.product ? { ...previous, product: { ...previous.product, status: event.status || 'SOLD' } } : previous);
    socket.on('auction:sold', closeAuction); socket.on('auction:expired', closeAuction); socket.on('offer:accepted', closeAuction); socket.on('listing:cancelled', closeAuction);
    return () => { socket.emit('product:leave', id); socket.disconnect(); };
  }, [id, queryClient]);

  const bidMutation = useMutation({ mutationFn: () => api.post(`/products/${id}/bids`, { amount: Number(bidAmount) }), onSuccess: () => { setBidAmount(''); setNotice({ kind: 'success', message: 'Your bid was submitted.' }); queryClient.invalidateQueries({ queryKey: ['product', id] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); }, onError: (error) => setNotice({ kind: 'error', message: error.message }) });
  const offerMutation = useMutation({ mutationFn: () => api.post(`/products/${id}/offers`, { offeredAmount: Number(offerAmount) }), onSuccess: () => { setOfferOpen(false); setNotice({ kind: 'success', message: 'Offer accepted. The listing has been marked sold and an order was created.' }); queryClient.invalidateQueries({ queryKey: ['product', id] }); queryClient.invalidateQueries({ queryKey: ['products'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); }, onError: (error) => { setOfferError(error); setNotice({ kind: 'error', message: error.message }); } });

  const openOffer = useCallback(() => { setOfferError(null); setOfferAmount(String(minOffer.toFixed(2))); setOfferOpen(true); }, [minOffer]);
  async function submitReport(event) {
    event.preventDefault();
    try { await api.post(`/products/${id}/report`, { reason: reportReason }); setReportOpen(false); setReportReason(''); setNotice({ kind: 'success', message: 'Report submitted for moderator review.' }); }
    catch (error) { setNotice({ kind: 'error', message: error.message }); }
  }

  if (productQuery.isLoading) return <LoadingState label="Loading listing…" />;
  if (productQuery.error || !product) return <div className="space-y-4"><Link to="/" className="inline-flex items-center gap-2 text-sm text-brand-600"><ArrowLeft size={16} /> Back to listings</Link><ErrorNotice error={productQuery.error || 'Listing not found.'} /></div>;
  const isActive = product.status === 'ACTIVE' && new Date(product.auctionEndsAt).getTime() > Date.now();
  const currentPrice = Number(product.currentHighestBid) > 0 ? product.currentHighestBid : product.startingPrice;
  const topBids = [...(product.bids || [])].sort((a, b) => Number(b.amount) - Number(a.amount));

  return (
    <div className="space-y-6"><Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600"><ArrowLeft size={16} /> All listings</Link>
      {notice && <div className="space-y-2">{notice.kind === 'success' ? <SuccessNotice>{notice.message}</SuccessNotice> : <ErrorNotice error={notice.message} />}</div>}
      <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-3"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">{product.images?.[selectedImage]?.url ? <img src={imageUrl(product.images[selectedImage].url)} alt={product.title} className="aspect-square max-h-[620px] w-full object-contain" /> : <div className="flex aspect-square items-center justify-center text-slate-400"><ImageOff size={48} /></div>}</div>{product.images?.length > 1 && <div className="flex gap-2 overflow-x-auto">{product.images.map((image, index) => <button type="button" key={image.id} onClick={() => setSelectedImage(index)} className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${index === selectedImage ? 'border-brand-500' : 'border-transparent'}`}><img src={imageUrl(image.url)} alt={`${product.title} view ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div>}</div>
        <div className="space-y-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={product.status} /><span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{product.category}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{product.condition}</span></div><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{product.title}</h1><p className="mt-3 whitespace-pre-line leading-7 text-slate-600 dark:text-slate-300">{product.description}</p></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-sm text-slate-500">{Number(product.currentHighestBid) > 0 ? 'Current highest bid' : 'Starting price'}</p><p className="mt-1 text-2xl font-black tabular-nums">{formatEUR(currentPrice)}</p><p className="mt-1 text-xs text-slate-500">{product._count?.bids || 0} bids</p></div><div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-sm text-slate-500">Auction closes</p><p className="mt-1 flex items-center gap-2 text-lg font-bold"><Clock3 size={17} />{isActive ? timeRemaining(product.auctionEndsAt) : 'Closed'}</p><p className="mt-1 text-xs text-slate-500">{formatDate(product.auctionEndsAt)}</p></div></div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-4 dark:bg-slate-900"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200"><UserRound size={18} /></span><div className="min-w-0"><p className="text-xs text-slate-500">Listed by</p><p className="truncate font-semibold">{product.seller?.fullName || 'Seller'}</p></div><div className="ml-auto text-right text-xs text-slate-500">Listed {formatDate(product.createdAt, false)}</div></div>
          {canBuy && isActive && <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-900 dark:bg-brand-950/30"><div><h2 className="font-bold">Place a bid</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Your bid must exceed {formatEUR(Math.max(Number(product.currentHighestBid || 0), Number(product.startingPrice)))}.</p></div><form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); bidMutation.mutate(); }}><div className="flex-1"><input className="field bg-white dark:bg-slate-900" type="number" min={minBid.toFixed(2)} step="0.01" required placeholder={`Minimum ${formatEUR(minBid)}`} value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} aria-label="Bid amount in euros" /></div><Button type="submit" disabled={bidMutation.isPending || Number(bidAmount) < minBid}><Gavel size={16} />{bidMutation.isPending ? 'Submitting…' : 'Place bid'}</Button></form>{product.allowDirectOffers && <div className="flex flex-col gap-2 border-t border-brand-200 pt-4 dark:border-brand-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Want to close the deal now?</p><p className="text-xs text-slate-600 dark:text-slate-300">A confirmed offer buys the item immediately.</p></div><Button variant="secondary" onClick={openOffer}><ShoppingBag size={16} /> Make an offer</Button></div>}</div>}
          {(!user || !canBuy) && isActive && <InfoNotice>{!user ? <>Sign in to place a bid or make an offer. <Link to="/login" className="font-semibold text-brand-600 underline">Sign in</Link></> : 'You cannot purchase your own listing.'}</InfoNotice>}
          {!isActive && <InfoNotice>This listing is not accepting further bids or offers.</InfoNotice>}
          <div className="flex flex-wrap gap-3">{user && user.id !== product.sellerId && <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}><AlertTriangle size={15} /> Report listing</Button>}<span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={15} /> Reserve price remains private</span></div>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Live bid history</h2><p className="text-sm text-slate-500">Updates when a new bid is accepted.</p></div><span className="text-xs text-slate-500">Latest {topBids.length} bids</span></div>{topBids.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{topBids.map((bid) => <div key={bid.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{bid.bidder?.fullName || bid.user?.fullName || 'Bidder'}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(bid.createdAt)}</p></div><p className="font-bold tabular-nums">{formatEUR(bid.amount)}</p></div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No bids yet. This listing is waiting for its first bid.</p>}</section>
      <Modal title="Confirm instant offer" open={offerOpen} onClose={() => setOfferOpen(false)} description="This offer is an immediate purchase, not a request for seller approval."><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); offerMutation.mutate(); }}><ErrorNotice error={offerError} /><Field label="Offer amount (EUR)" type="number" min={minOffer.toFixed(2)} step="0.01" required value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} hint={`Enter at least ${formatEUR(minOffer)}. The seller’s reserve price is not displayed.`} /><InfoNotice>Confirming closes the auction, marks the offer accepted, and creates an order record. The MVP does not process payment.</InfoNotice><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOfferOpen(false)}>Go back</Button><Button type="submit" disabled={offerMutation.isPending || Number(offerAmount) < minOffer}>{offerMutation.isPending ? 'Confirming…' : `Buy for ${formatEUR(offerAmount)}`}</Button></div></form></Modal>
      <Modal title="Report this listing" open={reportOpen} onClose={() => setReportOpen(false)} description="Reports are reviewed by marketplace administrators."><form className="space-y-4" onSubmit={submitReport}><Field label="Reason" id="report-reason"><textarea id="report-reason" className="field min-h-28" minLength={8} maxLength={2000} required value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Describe the issue…" /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button><Button type="submit">Submit report</Button></div></form></Modal>
    </div>
  );
}
