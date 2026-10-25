import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { updateTransactionStatus } from '../services/transaction.service.js';
import { transactionStatusSchema } from '../validators/admin.schemas.js';
import { checkoutSchema, connectOnboardingSchema } from '../validators/payment.schemas.js';
import * as paymentService from '../services/payment.service.js';

export const updateStatus = asyncHandler(async (req, res) => {
  const input = transactionStatusSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'A valid transaction status is required.' } });
  const transaction = await updateTransactionStatus(req.params.id, req.user, input.data.status, req.ip);

  res.json({ transaction });
});

export const detail = asyncHandler(async (req, res) => {
  const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { product: { select: { id: true, title: true } }, buyer: { select: { id: true, fullName: true, email: true } }, seller: { select: { id: true, fullName: true, email: true } } } });
  if (!transaction) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found.' } });
  if (req.user.role !== 'ADMIN' && req.user.id !== transaction.buyerId && req.user.id !== transaction.sellerId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this transaction.' } });

  res.json({ transaction });
});

export const checkout = asyncHandler(async (req, res) => {
  const input = checkoutSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Choose Stripe or cash on delivery.' } });

  res.json(await paymentService.startCheckout(req.params.id, req.user.id, input.data.method));
});

export const confirmCodCollection = asyncHandler(async (req, res) => {
  const transaction = await paymentService.confirmCodCollection(req.params.id, req.user.id, req.ip);

  res.json({ transaction });
});

export const connectOnboarding = asyncHandler(async (req, res) => {
  const input = connectOnboardingSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Provide your Stripe account country as a two-letter country code.' } });
  
  res.json(await paymentService.createConnectOnboarding(req.user, input.data.country));
});

export const sellerPayouts = asyncHandler(async (req, res) => {
  res.json({ payouts: await paymentService.getSellerPayouts(req.user.id) });
});
