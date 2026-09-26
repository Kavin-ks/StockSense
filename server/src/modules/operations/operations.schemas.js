import { z } from 'zod';
import { isoDate, optionalId, pagination, quantity } from '../../utils/schemas.js';

export const OPERATION_TYPES = ['receipt', 'delivery', 'internal', 'adjustment'];
export const OPERATION_STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

const emptyToUndef = (schema) => schema.optional().or(z.literal('').transform(() => undefined));

const line = z.object({
  productId: z.coerce.number().int().positive('Choose a product'),
  quantity: quantity().refine((q) => q > 0, 'Quantity must be greater than 0'),
});

const lines = z.array(line).min(1, 'Add at least one product')
  .refine((ls) => new Set(ls.map((l) => l.productId)).size === ls.length, 'Each product may appear only once');

// Receipts / deliveries / internal transfers share one shape.
export const operationSchema = z.object({
  type: z.enum(['receipt', 'delivery', 'internal'], { error: 'Invalid operation type' }),
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  sourceLocationId: optionalId,
  destLocationId: optionalId,
  contact: z.string().trim().max(160).optional().default(''),
  deliveryAddress: z.string().trim().max(500).optional().default(''),
  scheduledDate: isoDate,
  responsibleId: optionalId,
  notes: z.string().trim().max(1000).optional().default(''),
  // Optimistic-concurrency token: the updatedAt the client loaded (edits only).
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  lines,
}).superRefine((d, ctx) => {
  if (d.type === 'receipt' && !d.contact) ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Supplier is required' });
  if (d.type === 'delivery' && !d.contact) ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Customer is required' });
  if (d.type === 'internal') {
    if (!d.sourceLocationId) ctx.addIssue({ code: 'custom', path: ['sourceLocationId'], message: 'Source location is required' });
    if (!d.destLocationId) ctx.addIssue({ code: 'custom', path: ['destLocationId'], message: 'Destination location is required' });
    if (d.sourceLocationId && d.sourceLocationId === d.destLocationId) {
      ctx.addIssue({ code: 'custom', path: ['destLocationId'], message: 'Destination must differ from source' });
    }
  }
});

export const adjustmentSchema = z.object({
  locationId: z.coerce.number().int().positive('Location is required'),
  notes: z.string().trim().max(1000).optional().default(''),
  lines: z.array(z.object({
    productId: z.coerce.number().int().positive('Choose a product'),
    countedQty: quantity('Counted quantity'),
  })).min(1, 'Add at least one product')
    .refine((ls) => new Set(ls.map((l) => l.productId)).size === ls.length, 'Each product may appear only once'),
});

export const operationListQuery = z.object({
  type: emptyToUndef(z.enum(OPERATION_TYPES)),
  status: emptyToUndef(z.enum(OPERATION_STATUSES)),
  warehouseId: optionalId,
  locationId: optionalId,
  categoryId: optionalId,
  search: z.string().trim().max(100).optional(),
  late: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  ...pagination,
});

export const pickSchema = z.object({
  lines: z.array(z.object({
    lineId: z.coerce.number().int().positive(),
    pickedQty: quantity('Picked quantity'),
  })).min(1, 'Nothing to pick'),
});
