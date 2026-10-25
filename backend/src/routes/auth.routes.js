import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, resendVerificationSchema, verifyEmailSchema } from '../validators/auth.schemas.js';
import * as controller from '../controllers/auth.controller.js';

const router = Router();
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), controller.resendVerification);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authMiddleware, controller.me);
router.post('/become-seller', authMiddleware, controller.becomeSeller);
router.get('/oauth/:provider', controller.oauthNotReady);

export default router;
