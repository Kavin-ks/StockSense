// Reusable zod building blocks shared across modules.
import { z } from 'zod';

export const idParam = z.object({ id: z.coerce.number().int().positive('Invalid id') });

export const optionalId = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const quantity = (label = 'Quantity') =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` })
    .finite()
    .min(0, `${label} cannot be negative`)
    .max(1e9, `${label} is too large`);

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const paged = (rows, total, { page, pageSize }) => ({
  data: rows,
  meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
});
