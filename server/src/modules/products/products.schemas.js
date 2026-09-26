import { z } from 'zod';
import { optionalId, pagination, quantity } from '../../utils/schemas.js';

export const UOMS = ['Units', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'Box', 'Pack', 'Dozen'];

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  sku: z.string().trim().toUpperCase().min(2, 'SKU is required').max(40)
    .regex(/^[A-Z0-9_-]+$/, 'SKU may only contain letters, numbers, "-" and "_"'),
  categoryId: optionalId,
  uom: z.enum(UOMS, { errorMap: () => ({ message: 'Choose a valid unit of measure' }) }),
  unitCost: quantity('Unit cost').default(0),
});

export const createProductSchema = productSchema.extend({
  // Optional initial stock is posted through the ledger as an adjustment.
  initialStock: quantity('Initial stock').optional(),
  initialLocationId: optionalId,
}).refine((d) => !d.initialStock || d.initialLocationId, {
  path: ['initialLocationId'],
  message: 'Choose a location for the initial stock',
});

export const productListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: optionalId,
  warehouseId: optionalId,
  locationId: optionalId,
  stockStatus: z.enum(['low', 'out', 'in']).optional().or(z.literal('').transform(() => undefined)),
  ...pagination,
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
});

export const reorderRuleSchema = z.object({
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  minQty: quantity('Minimum quantity'),
  maxQty: quantity('Maximum quantity'),
}).refine((d) => d.maxQty >= d.minQty, { path: ['maxQty'], message: 'Maximum must be ≥ minimum' });
