import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:5000'),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().trim().optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_PLATFORM_COUNTRY: z.string().length(2).default('EE'),
  STRIPE_CURRENCY: z.string().length(3).default('eur').transform((value) => value.toLowerCase()),
  MARKETPLACE_COMMISSION_BPS: z.coerce.number().int().min(0).max(2500).default(500),
  SELLER_PAYOUT_HOLD_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  PAYMENT_WORKER_INTERVAL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must contain at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  UPLOAD_DIR: z.string().default('uploads'),
}).superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && Boolean(values.STRIPE_SECRET_KEY) !== Boolean(values.STRIPE_WEBHOOK_SECRET)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['STRIPE_WEBHOOK_SECRET'],
      message: 'Configure both Stripe secret and webhook signing keys in production.',
    });
  }
  if (values.NODE_ENV === 'production' && new URL(values.FRONTEND_URL).protocol !== 'https:') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['FRONTEND_URL'],
      message: 'FRONTEND_URL must use HTTPS in production.',
    });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
