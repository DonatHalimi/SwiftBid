import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as controller from '../controllers/transactions.controller.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
router.post('/connect/onboarding', authMiddleware, requireRole('SELLER', 'ADMIN'), controller.connectOnboarding);
router.get('/payouts', authMiddleware, requireRole('SELLER', 'ADMIN'), controller.sellerPayouts);
router.post('/:id/checkout', authMiddleware, controller.checkout);
router.post('/:id/cod-collected', authMiddleware, controller.confirmCodCollection);
router.get('/:id', authMiddleware, controller.detail);
router.patch('/:id/status', authMiddleware, controller.updateStatus);

export default router;
