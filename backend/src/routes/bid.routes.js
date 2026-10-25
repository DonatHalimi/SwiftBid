import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bidSchema } from '../validators/product.schemas.js';
import * as controller from '../controllers/bids.controller.js';

const router = Router();
router.post('/:productId/bids', authMiddleware, requireRole('BUYER', 'SELLER'), validate(bidSchema), controller.create);

export default router;
