import { z } from 'zod';

const currencyAmount = z.coerce.number().finite().positive().refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Use no more than two decimal places.').refine((n) => n <= 9_999_999_999.99, 'Amount exceeds the supported currency range.').transform((n) => Number(n.toFixed(2)));
const optionalAmount = z.preprocess((value) => value === '' || value == null ? undefined : value, currencyAmount.optional());

export const createProductSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(20).max(10000),
  startingPrice: currencyAmount,
  reservePrice: optionalAmount,
  category: z.string().trim().min(2).max(60),
  condition: z.enum(['NEW', 'USED', 'REFURBISHED']).default('USED'),
  auctionEndsAt: z.coerce.date().refine((date) => date.getTime() > Date.now() + 60_000, 'Auction end must be at least one minute in the future.'),
  allowDirectOffers: z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean()).default(true),
}).refine((input) => input.reservePrice == null || input.reservePrice >= input.startingPrice, {
  path: ['reservePrice'], message: 'Reserve price cannot be lower than the starting price.',
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.enum(['ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED']).default('ACTIVE'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  sort: z.enum(['endingSoon', 'newest', 'priceAsc', 'priceDesc']).default('endingSoon'),
});

export const reportSchema = z.object({ reason: z.string().trim().min(8).max(2000) });
export const bidSchema = z.object({ amount: currencyAmount });
export const offerSchema = z.object({ offeredAmount: currencyAmount });
