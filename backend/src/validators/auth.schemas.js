import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10, 'Use at least 10 characters.').max(72, 'Use no more than 72 characters.').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must fit within bcrypt’s 72-byte input limit.'),
  fullName: z.string().trim().min(2).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32).max(128),
});
