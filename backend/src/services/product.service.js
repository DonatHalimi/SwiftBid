import { prisma } from '../lib/prisma.js';
import { emitProductEvent } from '../lib/socket.js';
import { notFound, forbidden, conflict } from '../utils/AppError.js';
import { toMoney } from '../utils/money.js';

const publicProduct = (product) => {
  if (!product) return product;
  const { reservePrice: _reservePrice, ...safe } = product;
  return safe;
};

export async function listProducts(query) {
  const where = {
    status: query.status,
    ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
    ...(query.q ? { OR: [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
      { category: { contains: query.q, mode: 'insensitive' } },
    ] } : {}),
  };
  const orderBy = query.sort === 'newest' ? { createdAt: 'desc' }
    : query.sort === 'priceAsc' ? { startingPrice: 'asc' }
      : query.sort === 'priceDesc' ? { startingPrice: 'desc' }
        : { auctionEndsAt: 'asc' };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy, skip: (query.page - 1) * query.limit, take: query.limit,
      include: { images: { take: 1, orderBy: { createdAt: 'asc' } }, seller: { select: { id: true, fullName: true } }, _count: { select: { bids: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(publicProduct), pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { createdAt: 'asc' } },
      seller: { select: { id: true, fullName: true, createdAt: true } },
      bids: { orderBy: [{ createdAt: 'desc' }], take: 20, include: { user: { select: { id: true, fullName: true } } } },
      _count: { select: { bids: true, offers: true } },
    },
  });
  if (!product) throw notFound('Listing not found.');
  return publicProduct({ ...product, bids: product.bids.map((bid) => ({ ...bid, user: { id: bid.user.id, fullName: bid.user.fullName } })) });
}

export async function createProduct(input, sellerId, files) {
  const product = await prisma.product.create({
    data: {
      title: input.title, description: input.description, startingPrice: toMoney(input.startingPrice),
      ...(input.reservePrice != null ? { reservePrice: toMoney(input.reservePrice) } : {}),
      currentHighestBid: toMoney(0), category: input.category, condition: input.condition,
      auctionEndsAt: input.auctionEndsAt, allowDirectOffers: input.allowDirectOffers, sellerId,
      images: { create: (files ?? []).map((file) => ({ url: `/uploads/${file.filename}` })) },
    }, include: { images: true, seller: { select: { id: true, fullName: true } } },
  });
  return product;
}

export async function cancelOwnListing(productId, user) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { _count: { select: { bids: true } } } });
  if (!product) throw notFound('Listing not found.');
  if (product.sellerId !== user.id && user.role !== 'ADMIN') throw forbidden();
  if (product.status !== 'ACTIVE') throw conflict('Only active listings can be cancelled.');
  if (user.role !== 'ADMIN' && product._count.bids > 0) throw conflict('A listing with bids cannot be cancelled by its seller. Contact support for moderation.');
  const updated = await prisma.product.updateMany({
    where: { id: productId, status: 'ACTIVE', ...(user.role !== 'ADMIN' ? { currentHighestBid: product.currentHighestBid } : {}) },
    data: { status: 'CANCELLED' },
  });
  if (updated.count !== 1) throw conflict();
  emitProductEvent(productId, 'listing:cancelled', { productId, status: 'CANCELLED' });
  return { id: productId, status: 'CANCELLED' };
}

export async function reportListing({ productId, reporterId, reason }) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, sellerId: true } });
  if (!product) throw notFound('Listing not found.');
  if (product.sellerId === reporterId) throw forbidden('You cannot report your own listing.');
  return prisma.listingReport.create({ data: { productId, reporterId, reason } });
}
