import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { emitProductEvent } from '../lib/socket.js';
import { AppError, conflict, forbidden, notFound } from '../utils/AppError.js';
import { toMoney } from '../utils/money.js';

export async function makeInstantOffer({ productId, userId, offeredAmount }) {
  const amount = toMoney(offeredAmount);
  let result;
  try { result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw notFound('Listing not found.');
    if (product.sellerId === userId) throw forbidden('You cannot purchase your own listing.');
    if (!product.allowDirectOffers) throw new AppError(400, 'Instant offers are disabled for this listing.', 'OFFERS_DISABLED');
    const now = new Date();
    if (product.status !== 'ACTIVE' || product.auctionEndsAt <= now) throw conflict('This listing is no longer available.');

    // Because confirmation settles instantly without seller review, do not permit an offer below
    // the existing bid or the seller's hidden reserve. Never return reservePrice to the client.
    let required = Prisma.Decimal.max(product.startingPrice, product.currentHighestBid, product.reservePrice ?? 0);
    if (product.currentHighestBid.gt(0) && required.lte(product.currentHighestBid)) required = product.currentHighestBid.plus('0.01');
    if (amount.lt(required)) throw new AppError(400, 'Your offer must meet the listing’s minimum purchase amount and beat any current leading bid.', 'OFFER_TOO_LOW');

    const claim = await tx.$queryRaw`
      UPDATE "Product"
      SET "status" = 'SOLD', "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
      WHERE "id" = ${product.id}
        AND "status" = 'ACTIVE'
        AND "allowDirectOffers" = true
        AND "auctionEndsAt" > (clock_timestamp() AT TIME ZONE 'UTC')
        AND "currentHighestBid" = ${product.currentHighestBid}
      RETURNING "id"
    `;
    if (claim.length !== 1) throw conflict('Another buyer or auction settlement closed this listing first.');

    const offer = await tx.offer.create({ data: { productId, userId, offeredAmount: amount, status: 'ACCEPTED' } });
    const transaction = await tx.transaction.create({
      data: { productId, buyerId: userId, sellerId: product.sellerId, finalAmount: amount, status: 'PENDING_PAYMENT' },
    });
    return { offer, transaction, title: product.title };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (['P2002', 'P2034'].includes(error?.code)) throw conflict('Another buyer or auction settlement closed this listing first.');
    throw error;
  }

  const payload = {
    productId, status: 'SOLD', title: result.title,
    offer: { id: result.offer.id, offeredAmount: result.offer.offeredAmount.toFixed(2), status: result.offer.status },
    transactionId: result.transaction.id,
  };
  emitProductEvent(productId, 'offer:accepted', payload);
  emitProductEvent(productId, 'auction:sold', payload);
  return payload;
}
