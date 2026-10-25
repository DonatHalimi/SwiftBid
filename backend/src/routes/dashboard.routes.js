import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as controller from '../controllers/dashboard.controller.js';

const router = Router();
router.get('/me', authMiddleware, controller.mine);

export default router;
