import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  if (error instanceof SyntaxError && Object.hasOwn(error, 'body')) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON.' } });
  }
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 && !error.name?.startsWith('Multer')) {
    return res.status(error.status).json({ error: { code: 'INVALID_REQUEST', message: error.expose ? error.message : 'The request could not be processed.' } });
  }
  if (error?.name === 'MulterError') {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: { code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', message: tooLarge ? 'Each image must be 5 MB or smaller.' : error.message },
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return res.status(409).json({ error: { code: 'UNIQUE_CONSTRAINT', message: 'A record with those details already exists.' } });
    if (error.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested record was not found.' } });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  }
  if (!isProduction) console.error(error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } });
}
