export class AppError extends Error {
  constructor(statusCode, message, code = 'REQUEST_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have permission to do that') => new AppError(403, message, 'FORBIDDEN');
export const notFound = (message = 'Resource not found') => new AppError(404, message, 'NOT_FOUND');
export const conflict = (message = 'The resource has changed; refresh and try again') => new AppError(409, message, 'CONFLICT');
