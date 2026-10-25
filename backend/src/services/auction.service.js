import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { emitProductEvent } from '../lib/socket.js';
import { AppError, conflict, notFound, forbidden } from '../utils/AppError.js';
import { meetsReserve, toMoney } from '../utils/money.js';

class BidRace extends Error {}

export async function placeBid({ productId, userId, amount }) {
  const bidAmount = toMoney(amount);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const bid = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, title: true, sellerId: true, status: true, startingPrice: true, currentHighestBid: true, auctionEndsAt: true },
        });
        if (!product) throw notFound('Listing not found.');
        if (product.sellerId === userId) throw forbidden('You cannot bid on your own listing.');
        const now = new Date();
        if (product.status !== 'ACTIVE' || product.auctionEndsAt <= now) throw conflict('This auction is no longer accepting bids.');
        const minimum = Prisma.Decimal.max(product.currentHighestBid, product.startingPrice);
        if (bidAmount.lte(minimum)) throw new AppError(400, `Your bid must be higher than €${minimum.toFixed(2)}.`, 'BID_TOO_LOW');

        // Compare-and-set prevents stale concurrent requests from overwriting a higher bid.
        // (clock_timestamp() AT TIME ZONE 'UTC') is evaluated by PostgreSQL at the update, not using a timestamp
        // captured before a transaction waits on a competing bid near the close boundary.
        const claim = await tx.$queryRaw`
          UPDATE "Product"
          SET "currentHighestBid" = ${bidAmount}, "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
          WHERE "id" = ${product.id}
            AND "status" = 'ACTIVE'
            AND "auctionEndsAt" > (clock_timestamp() AT TIME ZONE 'UTC')
            AND "currentHighestBid" = ${product.currentHighestBid}
          RETURNING "id"
        `;
        if (claim.length !== 1) throw new BidRace();
        return tx.bid.create({
          data: { productId: product.id, userId, amount: bidAmount },
          include: { user: { select: { id: true, fullName: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      const payload = { id: bid.id, productId, amount: bid.amount.toFixed(2), createdAt: bid.createdAt, bidder: { id: bid.user.id, fullName: bid.user.fullName } };
      emitProductEvent(productId, 'bid:new', payload);
      return payload;
    } catch (error) {
      if ((error instanceof BidRace || error?.code === 'P2034') && attempt < 2) continue;
      if (error instanceof BidRace) throw conflict('A competing bid was accepted first. Refresh the listing and try again.');
      if (error?.code === 'P2034') throw conflict('There is unusually high bidding activity. Refresh and try again.');
      throw error;
    }
  }
  throw conflict();
}

export async function settleExpiredAuctions() {
  const now = new Date();
  const candidates = await prisma.product.findMany({
    where: { status: 'ACTIVE', auctionEndsAt: { lte: now } },
    select: { id: true }, take: 100, orderBy: { auctionEndsAt: 'asc' },
  });
  for (const candidate of candidates) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: candidate.id } });
        if (!product || product.status !== 'ACTIVE' || product.auctionEndsAt > new Date()) return null;
        const winnerBid = await tx.bid.findFirst({
          where: { productId: product.id }, orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, userId: true, amount: true },
        });
        const sold = winnerBid && meetsReserve(product.currentHighestBid, product.reservePrice);
        const update = await tx.product.updateMany({
          where: { id: product.id, status: 'ACTIVE', auctionEndsAt: { lte: new Date() } },
          data: { status: sold ? 'SOLD' : 'EXPIRED' },
        });
        if (update.count !== 1) return null;
        if (!sold) return { id: product.id, status: 'EXPIRED', title: product.title };
        await tx.transaction.create({
          data: { productId: product.id, buyerId: winnerBid.userId, sellerId: product.sellerId, finalAmount: winnerBid.amount, status: 'PENDING_PAYMENT' },
        });
        return { id: product.id, status: 'SOLD', title: product.title, buyerId: winnerBid.userId, finalAmount: winnerBid.amount.toFixed(2) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result) emitProductEvent(result.id, result.status === 'SOLD' ? 'auction:sold' : 'auction:expired', result);
    } catch (error) {
      // Multiple API replicas may attempt settlement. A unique product transaction and conditional
      // status update make it safe; P2034/P2002 indicate another worker won the race.
      if (!['P2034', 'P2002'].includes(error?.code)) console.error('Auction settlement failed for', candidate.id, error);
    }
  }
}
