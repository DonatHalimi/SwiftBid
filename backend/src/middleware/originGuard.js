import { forbidden } from '../utils/AppError.js';
import { env } from '../config/env.js';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export function originGuard(req, _res, next) {
  const origin = req.get('origin');
  if (mutatingMethods.has(req.method) && origin && origin !== env.FRONTEND_URL) return next(forbidden('Request origin is not allowed.'));
  next();
}
