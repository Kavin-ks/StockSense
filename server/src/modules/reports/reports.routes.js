import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { optionalId } from '../../utils/schemas.js';
import * as service from './reports.service.js';

const router = Router();
const int = (min, max, def) => z.coerce.number().int().min(min).max(max).default(def);

router.get('/movement', validate({ query: z.object({ days: int(7, 90, 30), warehouseId: optionalId }) }),
  asyncHandler(async (req, res) => res.json(await service.movementSeries(req.valid.query))));
router.get('/activity', validate({ query: z.object({ limit: int(1, 50, 15) }) }),
  asyncHandler(async (req, res) => res.json(await service.activityFeed(req.valid.query))));
router.get('/reorder-suggestions', asyncHandler(async (_req, res) => res.json(await service.reorderSuggestions())));
router.get('/insights', validate({ query: z.object({ windowDays: int(7, 180, 30), deadDays: int(14, 365, 60) }) }),
  asyncHandler(async (req, res) => res.json(await service.stockInsights(req.valid.query))));
router.get('/cycle-counts', validate({ query: z.object({ everyDays: int(7, 180, 30) }) }),
  asyncHandler(async (req, res) => res.json(await service.cycleCounts(req.valid.query))));

export default router;
