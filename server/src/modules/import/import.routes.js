import express, { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/auth.js';
import * as service from './import.service.js';

const router = Router();

// CSV is sent as the raw request body (text/csv), up to 2 MB.
router.post('/products', requirePermission('products.write'),
  express.text({ type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'], limit: '2mb' }),
  validate({ query: z.object({ dryRun: z.enum(['true', 'false']).optional().transform((v) => v === 'true') }) }),
  asyncHandler(async (req, res) => res.json(await service.importProducts(req.body, req.valid.query, req.user))));

export default router;
