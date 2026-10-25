import { z } from 'zod';

export const updateUserSchema = z.object({
  role: z.enum(['BUYER', 'SELLER', 'ADMIN']).optional(),
  isSuspended: z.boolean().optional(),
}).refine((value) => value.role !== undefined || value.isSuspended !== undefined, 'Provide a role or suspension change.');

export const reportStatusSchema = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']) });
export const transactionStatusSchema = z.object({ status: z.enum(['SHIPPED', 'COMPLETED', 'CANCELLED']) });
export const paginationSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['BUYER', 'SELLER', 'ADMIN']).optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
