import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { emitProductEvent } from '../lib/socket.js';
import { AppError, forbidden, notFound, conflict } from '../utils/AppError.js';
import { writeAudit } from '../utils/audit.js';

const transitions = {
  PENDING_PAYMENT: ['CANCELLED'],
  PROCESSING: ['SHIPPED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateTransactionStatus(transactionId, actor, nextStatus, ipAddress) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId }, include: { product: { select: { id: true, title: true } } } });
  if (!transaction) throw notFound('Transaction not found.');
  if (actor.role !== 'ADMIN' && actor.id !== transaction.buyerId && actor.id !== transaction.sellerId) throw forbidden();
  if (nextStatus === 'SHIPPED' && actor.id !== transaction.sellerId && actor.role !== 'ADMIN') throw forbidden('Only the seller can mark an order as shipped.');
  if (nextStatus === 'COMPLETED' && actor.id !== transaction.buyerId && actor.role !== 'ADMIN') throw forbidden('Only the buyer can confirm receipt.');
  if (nextStatus === 'SHIPPED' && !['PAID', 'COD_DUE'].includes(transaction.paymentStatus)) throw conflict('Payment must be confirmed or cash on delivery selected before shipping.');
  if (nextStatus === 'COMPLETED' && transaction.paymentStatus === 'COD_DUE') throw conflict('The seller must confirm COD cash collection before you complete this order.');
  if (nextStatus === 'CANCELLED' && actor.role !== 'ADMIN' && transaction.status !== 'PENDING_PAYMENT') throw forbidden('Contact support to cancel an order after payment processing has begun.');
  if (!transitions[transaction.status]?.includes(nextStatus)) throw new AppError(400, `Cannot move an order from ${transaction.status} to ${nextStatus}.`, 'INVALID_TRANSACTION_TRANSITION');

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.transaction.updateMany({
      where: { id: transactionId, status: transaction.status },
      data: { status: nextStatus, ...(nextStatus === 'COMPLETED' ? { completedAt: new Date() } : {}) },
    });
    if (changed.count !== 1) throw conflict('The order changed during this update. Refresh and try again.');
    if (nextStatus === 'CANCELLED') {
      // A cancelled sale must not leave a listing looking sold with no live order behind it.
      await tx.product.updateMany({ where: { id: transaction.productId, status: 'SOLD' }, data: { status: 'CANCELLED' } });
    }
    return tx.transaction.findUnique({ where: { id: transactionId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (actor.role === 'ADMIN') {
    await writeAudit({ actorId: actor.id, action: 'TRANSACTION_STATUS_CHANGED', targetType: 'Transaction', targetId: transactionId, metadata: { from: transaction.status, to: nextStatus }, ipAddress });
  }
  if (nextStatus === 'CANCELLED') {
    emitProductEvent(transaction.productId, 'transaction:cancelled', { productId: transaction.productId, transactionId, status: nextStatus });
    emitProductEvent(transaction.productId, 'listing:cancelled', { productId: transaction.productId, status: 'CANCELLED' });
  }
  return updated;
}
