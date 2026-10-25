import { asyncHandler } from '../utils/asyncHandler.js';
import { updateUserSchema, reportStatusSchema, paginationSchema } from '../validators/admin.schemas.js';
import * as adminService from '../services/admin.service.js';
import { updateTransactionStatus } from '../services/transaction.service.js';
import { transactionStatusSchema } from '../validators/admin.schemas.js';
import { writeAudit } from '../utils/audit.js';

function parseQuery(req, res, next) {
  const result = paginationSchema.safeParse(req.query);
  if (!result.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid pagination or filter values.' } });
  req.adminQuery = result.data;
  next();
}

export const metrics = asyncHandler(async (_req, res) => res.json({ metrics: await adminService.getMetrics() }));
export const users = [parseQuery, asyncHandler(async (req, res) => res.json(await adminService.listUsers(req.adminQuery)))];
export const updateUser = asyncHandler(async (req, res) => {
  const input = updateUserSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Provide a valid role or suspension update.' } });
  const user = await adminService.updateUser(req.params.id, req.user.id, input.data);
  await writeAudit({ actorId: req.user.id, action: 'USER_UPDATED', targetType: 'User', targetId: user.id, metadata: input.data, ipAddress: req.ip });
  res.json({ user });
});
export const listings = [parseQuery, asyncHandler(async (req, res) => res.json(await adminService.listListings(req.adminQuery)))];
export const cancelListing = asyncHandler(async (req, res) => res.json(await adminService.cancelListing(req.params.id, req.user.id, req.ip)));
export const reports = [parseQuery, asyncHandler(async (req, res) => res.json(await adminService.listReports(req.adminQuery)))];
export const reviewReport = asyncHandler(async (req, res) => {
  const input = reportStatusSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'A valid report status is required.' } });
  res.json({ report: await adminService.reviewReport(req.params.id, req.user.id, input.data.status, req.ip) });
});
export const deleteImage = asyncHandler(async (req, res) => res.json(await adminService.deleteListingImage(req.params.imageId, req.user.id, req.ip)));
export const transactions = [parseQuery, asyncHandler(async (req, res) => res.json(await adminService.listTransactions(req.adminQuery)))];
export const updateTransaction = asyncHandler(async (req, res) => {
  const input = transactionStatusSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'A valid transaction status is required.' } });
  const transaction = await updateTransactionStatus(req.params.id, req.user, input.data.status, req.ip);
  res.json({ transaction });
});
export const auditLogs = [parseQuery, asyncHandler(async (req, res) => res.json(await adminService.listAuditLogs(req.adminQuery)))];
