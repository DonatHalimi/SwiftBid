import Stripe from 'stripe';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let stripeClient;

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'Online payments are temporarily unavailable. Please try again later.', 'PAYMENTS_NOT_CONFIGURED');
  }
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}
