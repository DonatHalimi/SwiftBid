import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { offerSchema } from '../validators/product.schemas.js';
import * as controller from '../controllers/offers.controller.js';

const router = Router();
router.post('/:productId/offers', authMiddleware, requireRole('BUYER', 'SELLER'), validate(offerSchema), controller.create);

export default router;
