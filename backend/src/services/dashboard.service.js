import { prisma } from '../lib/prisma.js';

export async function getDashboard(userId) {
  const [bids, offers, listings, purchases, sales] = await Promise.all([
    prisma.bid.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, include: { product: { select: { id: true, title: true, status: true, auctionEndsAt: true, currentHighestBid: true, images: { take: 1 } } } } }),
    prisma.offer.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, include: { product: { select: { id: true, title: true, status: true, images: { take: 1 } } } } }),
    prisma.product.findMany({ where: { sellerId: userId }, orderBy: { createdAt: 'desc' }, take: 100, include: { images: { take: 1 }, _count: { select: { bids: true } } } }),
    prisma.transaction.findMany({ where: { buyerId: userId }, orderBy: { createdAt: 'desc' }, include: { product: { select: { id: true, title: true, images: { take: 1 } } }, seller: { select: { id: true, fullName: true, email: true } } } }),
    prisma.transaction.findMany({ where: { sellerId: userId }, orderBy: { createdAt: 'desc' }, include: { product: { select: { id: true, title: true, images: { take: 1 } } }, buyer: { select: { id: true, fullName: true, email: true } } } }),
  ]);
  return { bids, offers, listings, purchases, sales };
}
