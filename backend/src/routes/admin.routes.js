import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import * as controller from '../controllers/admin.controller.js';

const router = Router();
router.use(authMiddleware, requireRole('ADMIN'));
router.get('/metrics', controller.metrics);
router.get('/users', ...controller.users);
router.patch('/users/:id', controller.updateUser);
router.get('/listings', ...controller.listings);
router.post('/listings/:id/cancel', controller.cancelListing);
router.delete('/images/:imageId', controller.deleteImage);
router.get('/reports', ...controller.reports);
router.patch('/reports/:id', controller.reviewReport);
router.get('/transactions', ...controller.transactions);
router.patch('/transactions/:id', controller.updateTransaction);
router.get('/audit-logs', ...controller.auditLogs);

export default router;
