import { z } from 'zod';

export const checkoutSchema = z.object({ method: z.enum(['STRIPE', 'COD']) });
export const connectOnboardingSchema = z.object({ country: z.string().trim().length(2).transform((value) => value.toUpperCase()) });
