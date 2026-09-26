import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { optionalId } from '../../utils/schemas.js';
import { query } from '../../db/pool.js';
import * as service from './dashboard.service.js';

const router = Router();

router.get('/summary', validate({ query: z.object({ warehouseId: optionalId, locationId: optionalId, categoryId: optionalId }) }),
  asyncHandler(async (req, res) => res.json(await service.getSummary(req.valid.query))));

router.get('/alerts', asyncHandler(async (_req, res) => res.json(await service.getLowStockAlerts())));

// Small lookup used by "Responsible" pickers.
router.get('/users', asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT id, name, login_id AS "loginId" FROM users ORDER BY name');
  res.json(rows);
}));

export default router;
