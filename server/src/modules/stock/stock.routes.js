import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { isoDate, optionalId, pagination, paged } from '../../utils/schemas.js';
import * as service from './stock.service.js';

const router = Router();

const movesQuery = z.object({
  search: z.string().trim().max(100).optional(),
  productId: optionalId,
  warehouseId: optionalId,
  direction: z.enum(['in', 'out', 'internal']).optional().or(z.literal('').transform(() => undefined)),
  from: isoDate.optional().or(z.literal('').transform(() => undefined)),
  to: isoDate.optional().or(z.literal('').transform(() => undefined)),
  ...pagination,
});

router.get('/', validate({ query: movesQuery }), asyncHandler(async (req, res) => {
  const { rows, total } = await service.listMoves(req.valid.query);
  res.json(paged(rows, total, req.valid.query));
}));

export default router;
