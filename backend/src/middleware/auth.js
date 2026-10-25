import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { unauthorized, forbidden } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authMiddleware = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) throw unauthorized();
  let claims;
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { issuer: 'ankand-api', audience: 'ankand-web' });
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  if (!claims?.sub) throw unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, fullName: true, role: true, isSuspended: true, isEmailVerified: true },
  });
  if (!user || user.isSuspended) throw unauthorized('This account is unavailable.');
  if (!user.isEmailVerified) throw forbidden('Verify your email address to continue.');
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden('Your account does not have permission for this action.'));
  next();
};
