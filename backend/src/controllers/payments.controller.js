import { asyncHandler } from '../utils/asyncHandler.js';
import { constructStripeEvent, handleStripeEvent } from '../services/payment.service.js';

export const stripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.get('stripe-signature');
  if (!signature) return res.status(400).json({ error: { code: 'MISSING_STRIPE_SIGNATURE', message: 'Stripe signature header is required.' } });
  const event = constructStripeEvent(req.body, signature);
  await handleStripeEvent(event);

  res.json({ received: true });
});
