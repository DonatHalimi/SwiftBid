import fs from 'node:fs/promises';
import { badRequest } from '../utils/AppError.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const error = badRequest('Please check the submitted fields.', result.error.issues.map((issue) => ({
        field: issue.path.join('.'), message: issue.message,
      })));
      if (Array.isArray(req.files) && req.files.length) {
        Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => undefined))).finally(() => next(error));
        return;
      }
      return next(error);
    }
    req.validated = result.data;
    next();
  };
}
