import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { idParam, paged } from '../../utils/schemas.js';
import { requirePermission } from '../../middleware/auth.js';
import * as s from './products.schemas.js';
import * as service from './products.service.js';

export const productRouter = Router();
export const categoryRouter = Router();

productRouter.get('/meta/uoms', (_req, res) => res.json(s.UOMS));

productRouter.get('/', validate({ query: s.productListQuery }), asyncHandler(async (req, res) => {
  const { rows, total } = await service.listProducts(req.valid.query);
  res.json(paged(rows, total, req.valid.query));
}));
productRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.getProduct(req.valid.params.id))));
const canWrite = requirePermission('products.write');

productRouter.post('/', canWrite, validate({ body: s.createProductSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createProduct(req.valid.body, req.user))));
productRouter.put('/:id', canWrite, validate({ params: idParam, body: s.updateProductSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateProduct(req.valid.params.id, req.valid.body, req.user))));

productRouter.put('/:id/reorder-rules', canWrite, validate({ params: idParam, body: s.reorderRuleSchema }), asyncHandler(async (req, res) =>
  res.json(await service.upsertReorderRule(req.valid.params.id, req.valid.body, req.user))));
productRouter.delete('/:id/reorder-rules/:ruleId', canWrite,
  validate({ params: idParam.extend({ ruleId: z.coerce.number().int().positive() }) }),
  asyncHandler(async (req, res) => res.json(await service.deleteReorderRule(req.valid.params.id, req.valid.params.ruleId, req.user))));

categoryRouter.get('/', asyncHandler(async (_req, res) => res.json(await service.listCategories())));
categoryRouter.post('/', canWrite, validate({ body: s.categorySchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createCategory(req.valid.body, req.user))));
