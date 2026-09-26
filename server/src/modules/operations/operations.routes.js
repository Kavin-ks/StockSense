import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { idParam, paged } from '../../utils/schemas.js';
import * as s from './operations.schemas.js';
import * as service from './operations.service.js';

const router = Router();

router.get('/', validate({ query: s.operationListQuery }), asyncHandler(async (req, res) => {
  const { rows, total } = await service.listOperations(req.valid.query);
  res.json(paged(rows, total, req.valid.query));
}));
router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.getOperation(req.valid.params.id))));

router.post('/', validate({ body: s.operationSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createOperation(req.valid.body, req.user.id))));
router.post('/adjustments', validate({ body: s.adjustmentSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createAdjustment(req.valid.body, req.user.id))));
router.put('/:id', validate({ params: idParam, body: s.operationSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateOperation(req.valid.params.id, req.valid.body))));

// State transitions are explicit actions, not generic "PATCH status".
router.post('/:id/confirm', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.confirmOperation(req.valid.params.id))));
router.post('/:id/validate', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.validateOperation(req.valid.params.id, req.user.id))));
router.post('/:id/cancel', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.cancelOperation(req.valid.params.id))));

export default router;
