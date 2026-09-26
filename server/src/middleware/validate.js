import { AppError } from '../utils/AppError.js';

/**
 * Validate and coerce req.body / req.query / req.params against zod schemas.
 * Produces field-level messages the UI can show next to each input.
 */
export const validate = (schemas) => (req, _res, next) => {
  const fieldErrors = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      // req.query is a getter in Express 5, so store parsed values separately.
      req.valid = { ...req.valid, [part]: result.data };
    } else {
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || part;
        fieldErrors[key] ??= issue.message;
      }
    }
  }
  if (Object.keys(fieldErrors).length) {
    return next(AppError.badRequest('Please correct the highlighted fields', fieldErrors));
  }
  next();
};
