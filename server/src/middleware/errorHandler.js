import { AppError } from '../utils/AppError.js';

// Map well-known PostgreSQL error codes to friendly API errors.
const PG_ERRORS = {
  '23505': (err) => AppError.conflict(uniqueMessage(err)),
  '23503': () => AppError.conflict('This record is referenced by other data and cannot be changed'),
  '23514': () => AppError.badRequest('A value is outside its allowed range'),
  '22P02': () => AppError.badRequest('Invalid identifier format'),
};

function uniqueMessage(err) {
  const c = err.constraint ?? '';
  if (c.includes('users_email')) return 'This email is already registered';
  if (c.includes('login_id')) return 'This Login ID is already taken';
  if (c.includes('sku')) return 'A product with this SKU already exists';
  if (c.includes('short_code')) return 'This short code is already in use';
  if (c.includes('categories')) return 'This category already exists';
  return 'A record with the same value already exists';
}

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;
  if (!(error instanceof AppError) && PG_ERRORS[err.code]) error = PG_ERRORS[err.code](err);
  if (err.type === 'entity.parse.failed') error = AppError.badRequest('Malformed JSON body');

  if (!(error instanceof AppError)) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    error = new AppError(500, 'Something went wrong. Please try again.');
  }
  res.status(error.status).json({ error: { message: error.message, fields: error.details } });
}
