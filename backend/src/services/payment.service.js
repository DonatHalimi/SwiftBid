import { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { AppError, conflict, forbidden, notFound } from '../utils/AppError.js';
import { writeAudit } from '../utils/audit.js';

const toMinorUnits = (amount) => Number(new Prisma.Decimal(amount).mul(100).toFixed(0));
const fromMinorUnits = (amount) => new Prisma.Decimal(amount).div(100);

function commissionFor(amount) {
  return new Prisma.Decimal(amount)
    .mul(env.MARKETPLACE_COMMISSION_BPS)
    .div(10_000)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function startCheckout(transactionId, userId, method) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      product: { select: { title: true } },
      buyer: { select: { id: true, email: true } },
    },
  });
  if (!transaction) throw notFound('Order not found.');
  if (transaction.buyerId !== userId) throw forbidden('Only the buyer can select the payment method.');
  if (transaction.status !== 'PENDING_PAYMENT') throw conflict('This order is no longer awaiting payment.');
  if (!['PENDING', 'FAILED'].includes(transaction.paymentStatus)) throw conflict('A payment attempt is already in progress or complete.');

  if (method === 'COD') {
    const changed = await prisma.transaction.updateMany({
      where: { id: transactionId, status: 'PENDING_PAYMENT', paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', paymentMethod: 'COD', paymentStatus: 'COD_DUE' },
    });
    if (changed.count !== 1) throw conflict('The order changed while selecting cash on delivery.');
    await writeAudit({
      actorId: userId,
      action: 'COD_SELECTED',
      targetType: 'Transaction',
      targetId: transactionId,
      metadata: { amount: transaction.finalAmount.toFixed(2), currency: env.STRIPE_CURRENCY },
    });
    return { method: 'COD', message: 'Cash on delivery selected. Pay the seller when your order arrives.' };
  }

  const stripe = getStripe();
  const claimed = await prisma.transaction.updateMany({
    where: { id: transactionId, status: 'PENDING_PAYMENT', paymentStatus: { in: ['PENDING', 'FAILED'] } },
    data: { paymentMethod: 'STRIPE', paymentStatus: 'PROCESSING' },
  });
  if (claimed.count !== 1) throw conflict('A payment attempt is already in progress or complete.');

  const attempt = await prisma.paymentAttempt.create({
    data: {
      transactionId,
      amount: transaction.finalAmount,
      currency: env.STRIPE_CURRENCY,
      status: 'CREATED',
    },
  });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: transaction.buyer.email,
      client_reference_id: transactionId,
      metadata: { transactionId, paymentAttemptId: attempt.id },
      payment_intent_data: {
        metadata: { transactionId, paymentAttemptId: attempt.id },
        transfer_group: `ORDER_${transactionId}`,
      },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY,
          unit_amount: toMinorUnits(transaction.finalAmount),
          product_data: { name: transaction.product.title },
        },
      }],
      success_url: `${env.FRONTEND_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/dashboard?payment=cancelled`,
    }, { idempotencyKey: `checkout-${attempt.id}` });

    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { stripeCheckoutSessionId: session.id, stripeCheckoutUrl: session.url, status: 'OPEN' },
    });
    return { method: 'STRIPE', checkoutUrl: session.url };
  } catch (error) {
    await prisma.$transaction([
      prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: error.code || 'CHECKOUT_CREATE_FAILED' } }),
      prisma.transaction.updateMany({ where: { id: transactionId, paymentStatus: 'PROCESSING' }, data: { paymentStatus: 'FAILED' } }),
    ]);
    if (error instanceof AppError) throw error;
    console.error('Stripe Checkout session creation failed:', error.message);
    throw new AppError(502, 'We could not start secure checkout. Please retry or choose cash on delivery.', 'CHECKOUT_START_FAILED');
  }
}

export function constructStripeEvent(rawBody, signature) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, 'Stripe webhook processing is not configured.', 'STRIPE_WEBHOOK_NOT_CONFIGURED');
  }
  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError(400, 'Stripe webhook signature is invalid.', 'INVALID_STRIPE_SIGNATURE');
  }
}

async function processCheckoutEvent(tx, event) {
  const session = event.data.object;
  const attempt = await tx.paymentAttempt.findUnique({ where: { stripeCheckoutSessionId: session.id } });
  if (!attempt) return;

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: event.type === 'checkout.session.expired' ? 'EXPIRED' : 'FAILED', failureCode: event.type },
    });
    await tx.transaction.updateMany({
      where: { id: attempt.transactionId, status: 'PENDING_PAYMENT', paymentStatus: 'PROCESSING' },
      data: { paymentStatus: 'FAILED' },
    });
    return;
  }

  if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}) },
    });
    return;
  }

  if (session.payment_status !== 'paid' && event.type !== 'checkout.session.async_payment_succeeded') return;
  const transaction = await tx.transaction.findUnique({ where: { id: attempt.transactionId } });
  if (!transaction) return;
  if (session.currency !== attempt.currency || session.amount_total !== toMinorUnits(attempt.amount) || !['PENDING_PAYMENT', 'PROCESSING'].includes(transaction.status)) {
    throw new AppError(400, 'Stripe payment details do not match the order.', 'PAYMENT_AMOUNT_MISMATCH');
  }
  if (transaction.paymentStatus === 'PAID') return;
  if (transaction.paymentStatus !== 'PROCESSING') return;

  const fee = commissionFor(attempt.amount);
  const net = new Prisma.Decimal(attempt.amount).minus(fee);
  await tx.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: 'PAID', ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}) },
  });
  const updated = await tx.transaction.updateMany({
    where: { id: transaction.id, status: 'PENDING_PAYMENT', paymentStatus: 'PROCESSING' },
    data: {
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      paymentMethod: 'STRIPE',
      paidAmount: attempt.amount,
      commissionAmount: fee,
      sellerNetAmount: net,
      paidAt: new Date(),
    },
  });
  if (updated.count !== 1) throw conflict('The order payment state changed while processing a Stripe event.');
  await tx.financialLedgerEntry.createMany({
    data: [
      { transactionId: transaction.id, userId: transaction.buyerId, type: 'PAYMENT', amount: attempt.amount, currency: attempt.currency, reference: `stripe-payment:${event.id}`, metadata: { paymentIntentId } },
      { transactionId: transaction.id, userId: transaction.sellerId, type: 'COMMISSION', amount: fee, currency: attempt.currency, reference: `stripe-commission:${event.id}`, metadata: { basisPoints: env.MARKETPLACE_COMMISSION_BPS } },
    ],
  });
}

export async function handleStripeEvent(event) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({ data: { stripeEventId: event.id, type: event.type } });
      if (event.type.startsWith('checkout.session.')) {
        await processCheckoutEvent(tx, event);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error?.code === 'P2002') {
      const processed = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id }, select: { id: true } });
      if (processed) return { duplicate: true };
    }
    throw error;
  }
  return { duplicate: false };
}

export async function confirmCodCollection(transactionId, sellerId, ipAddress) {
  const now = new Date();
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw notFound('Order not found.');
  if (transaction.sellerId !== sellerId) throw forbidden('Only the seller can confirm cash collection.');
  if (transaction.paymentMethod !== 'COD' || transaction.paymentStatus !== 'COD_DUE' || transaction.status !== 'SHIPPED') {
    throw conflict('Cash can be confirmed only for a shipped COD order that is still due.');
  }
  const fee = commissionFor(transaction.finalAmount);
  const net = new Prisma.Decimal(transaction.finalAmount).minus(fee);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.transaction.updateMany({
      where: { id: transactionId, status: 'SHIPPED', paymentStatus: 'COD_DUE', paymentMethod: 'COD' },
      data: { paymentStatus: 'PAID', paidAmount: transaction.finalAmount, commissionAmount: fee, sellerNetAmount: net, paidAt: now },
    });
    if (changed.count !== 1) throw conflict('Cash collection was already recorded or the order changed.');
    await tx.financialLedgerEntry.createMany({
      data: [
        { transactionId, userId: transaction.buyerId, type: 'COD_PAYMENT', amount: transaction.finalAmount, currency: env.STRIPE_CURRENCY, reference: `cod-payment:${transactionId}` },
        { transactionId, userId: sellerId, type: 'COMMISSION', amount: fee, currency: env.STRIPE_CURRENCY, reference: `cod-commission:${transactionId}`, metadata: { collection: 'cash-received-by-seller', commissionDueToMarketplace: true } },
      ],
    });
  });
  await writeAudit({ actorId: sellerId, action: 'COD_CASH_COLLECTED', targetType: 'Transaction', targetId: transactionId, metadata: { amount: transaction.finalAmount.toFixed(2), commissionDue: fee.toFixed(2) }, ipAddress });
  return prisma.transaction.findUnique({ where: { id: transactionId } });
}

function nextWeeklyTransferDate(completedAt) {
  const due = new Date(completedAt.getTime() + env.SELLER_PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
  const daysToMonday = (8 - due.getUTCDay()) % 7 || 7;
  due.setUTCDate(due.getUTCDate() + daysToMonday);
  due.setUTCHours(0, 0, 0, 0);
  return due;
}

export async function processDueSellerPayouts() {
  if (!env.STRIPE_SECRET_KEY) return;
  const stripe = getStripe();
  const now = new Date();
  const eligible = await prisma.transaction.findMany({
    where: {
      status: 'COMPLETED',
      paymentMethod: 'STRIPE',
      paymentStatus: 'PAID',
      refundedAmount: 0,
      disputes: { none: { status: { in: ['needs_response', 'under_review', 'warning_needs_response', 'warning_under_review'] } } },
      completedAt: { lte: new Date(now.getTime() - env.SELLER_PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000) },
      payout: null,
      seller: { stripeConnectAccountId: { not: null } },
    },
    include: { seller: { select: { stripeConnectAccountId: true } } },
    take: 50,
    orderBy: { completedAt: 'asc' },
  });

  for (const transaction of eligible) {
    const scheduledAt = nextWeeklyTransferDate(transaction.completedAt);
    if (scheduledAt > now) continue;
    try {
      await prisma.sellerPayout.create({
        data: { transactionId: transaction.id, amount: transaction.sellerNetAmount, currency: env.STRIPE_CURRENCY, scheduledAt },
      });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
    }
  }

  const due = await prisma.sellerPayout.findMany({
    where: { scheduledAt: { lte: now }, status: { in: ['PENDING', 'FAILED'] } },
    include: { transaction: { include: { seller: { select: { stripeConnectAccountId: true } } } },
    take: 50,
    orderBy: { scheduledAt: 'asc' },
  });
  for (const payout of due) {
    const accountId = payout.transaction.seller.stripeConnectAccountId;
    if (!accountId || payout.amount.lte(0)) continue;
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.details_submitted || !account.payouts_enabled || account.capabilities?.transfers !== 'active') {
        if (payout.status !== 'ON_HOLD') {
          await prisma.sellerPayout.update({ where: { id: payout.id }, data: { status: 'ON_HOLD', failureCode: 'SELLER_ACCOUNT_NOT_READY' } });
        }
        continue;
      }
      const transfer = await stripe.transfers.create({
        amount: toMinorUnits(payout.amount),
        currency: payout.currency,
        destination: accountId,
        transfer_group: `ORDER_${payout.transactionId}`,
        metadata: { transactionId: payout.transactionId, payoutId: payout.id },
      }, { idempotencyKey: `seller-payout-${payout.id}` });
      await prisma.$transaction(async (tx) => {
        await tx.sellerPayout.update({
          where: { id: payout.id },
          data: { stripeTransferId: transfer.id, status: 'SENT', sentAt: new Date(), failureCode: null },
        });
        await tx.financialLedgerEntry.create({
          data: {
            transactionId: payout.transactionId,
            userId: payout.transaction.sellerId,
            type: 'PAYOUT',
            amount: payout.amount,
            currency: payout.currency,
            reference: `stripe-payout:${payout.id}`,
            metadata: { transferId: transfer.id },
          },
        });
      });
    } catch (error) {
      console.error('Seller payout failed:', payout.id, error.message);
      await prisma.sellerPayout.update({
        where: { id: payout.id },
        data: { status: 'FAILED', failureCode: error.code || 'TRANSFER_FAILED' },
      });
    }
  }
}

export async function createConnectOnboarding(user, country) {
  const stripe = getStripe();
  const supportedCountry = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(supportedCountry)) {
    throw new AppError(400, 'Choose a valid two-letter country code for your Stripe account.', 'INVALID_COUNTRY');
  }
  let accountId = user.stripeConnectAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: supportedCountry,
      email: user.email,
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
      metadata: { userId: user.id },
    }, { idempotencyKey: `connect-account-${user.id}` });
    accountId = account.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeConnectAccountId: accountId } });
  } else {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.country !== supportedCountry) {
      throw conflict('Your existing payout account was created for a different country. Contact support to change it.');
    }
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${env.FRONTEND_URL}/dashboard?connect=refresh`,
    return_url: `${env.FRONTEND_URL}/dashboard?connect=complete`,
    type: 'account_onboarding',
  });
  return { url: link.url };
}

export async function getFinancialReport() {
  const [payments, payouts, pendingPayouts, codCommissionDue, disputes, recentPayouts, recentEntries] = await Promise.all([
    prisma.transaction.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { paidAmount: true, refundedAmount: true, commissionAmount: true }, _count: { id: true } }),
    prisma.sellerPayout.aggregate({ where: { status: 'SENT' }, _sum: { amount: true }, _count: { id: true } }),
    prisma.sellerPayout.aggregate({ where: { status: { in: ['PENDING', 'FAILED', 'ON_HOLD'] } }, _sum: { amount: true }, _count: { id: true } }),
    prisma.financialLedgerEntry.aggregate({ where: { type: 'COMMISSION', metadata: { path: ['commissionDueToMarketplace'], equals: true } }, _sum: { amount: true } }),
    prisma.paymentDispute.count({ where: { status: { notIn: ['won', 'warning_closed'] } } }),
    prisma.sellerPayout.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { transaction: { include: { seller: { select: { id: true, fullName: true, email: true } }, product: { select: { title: true } } } } }),
    prisma.financialLedgerEntry.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, fullName: true, email: true } }, transaction: { select: { id: true } } } }),
  ]);
  return {
    payments: { count: payments._count.id, gross: payments._sum.paidAmount?.toFixed(2) ?? '0.00', refunded: payments._sum.refundedAmount?.toFixed(2) ?? '0.00', commission: payments._sum.commissionAmount?.toFixed(2) ?? '0.00' },
    payouts: { sentAmount: payouts._sum.amount?.toFixed(2) ?? '0.00', sentCount: payouts._count.id, pendingAmount: pendingPayouts._sum.amount?.toFixed(2) ?? '0.00', pendingCount: pendingPayouts._count.id },
    codCommissionDue: codCommissionDue._sum.amount?.toFixed(2) ?? '0.00',
    openDisputes: disputes,
    recentPayouts,
    recentEntries,
  };
}

export async function getSellerPayouts(userId) {
  return prisma.sellerPayout.findMany({
    where: { transaction: { sellerId: userId } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { transaction: { include: { product: { select: { title: true } } } } },
  });
}
