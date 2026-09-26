import { z } from 'zod';

const shortCode = z.string().trim().toUpperCase()
  .min(1, 'Short code is required').max(10, 'Short code must be at most 10 characters')
  .regex(/^[A-Z0-9-]+$/, 'Short code may only contain letters, numbers and "-"');

export const warehouseSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  shortCode,
  address: z.string().trim().max(500).optional().default(''),
});

export const locationSchema = z.object({
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  shortCode: shortCode.max(20),
});
