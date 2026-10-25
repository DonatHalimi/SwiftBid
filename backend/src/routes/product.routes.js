import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImages } from '../middleware/upload.js';
import { createProductSchema, listQuerySchema, reportSchema } from '../validators/product.schemas.js';
import * as controller from '../controllers/products.controller.js';

const router = Router();
router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.get('/mine', authMiddleware, controller.dashboard);
router.post('/', authMiddleware, requireRole('SELLER', 'ADMIN'), uploadImages.array('images', 8), validate(createProductSchema), controller.create);
router.get('/:id', controller.getById);
router.post('/:id/report', authMiddleware, validate(reportSchema), controller.report);
router.post('/:id/cancel', authMiddleware, controller.cancel);
router.delete('/:id/images/:imageId', authMiddleware, controller.removeMyImage);

export default router;
