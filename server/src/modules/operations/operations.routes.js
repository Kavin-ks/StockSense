import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { assertCan, requirePermission } from '../../middleware/auth.js';
import { idParam, paged } from '../../utils/schemas.js';
import * as s from './operations.schemas.js';
import * as service from './operations.service.js';

const router = Router();

/**
 * Permission depends on the document type (see config/permissions.js):
 *   "manage"  = create / edit / cancel     "process" = To Do / Validate
 */
const authorize = (action) => asyncHandler(async (req, _res, next) => {
  // Existing documents are authorised by their stored type (a changed type in the body is rejected by the service).
  const type = req.valid.params?.id ? await service.getOperationType(req.valid.params.id) : req.valid.body.type;
  assertCan(req.user, `${type}.${action}`);
  next();
});

router.get('/', validate({ query: s.operationListQuery }), asyncHandler(async (req, res) => {
  const { rows, total } = await service.listOperations(req.valid.query);
  res.json(paged(rows, total, req.valid.query));
}));
router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.getOperation(req.valid.params.id))));

router.post('/', validate({ body: s.operationSchema }), authorize('manage'), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createOperation(req.valid.body, req.user))));
router.post('/adjustments', validate({ body: s.adjustmentSchema }), requirePermission('adjustment.manage'),
  asyncHandler(async (req, res) => res.status(201).json(await service.createAdjustment(req.valid.body, req.user))));
router.put('/:id', validate({ params: idParam, body: s.operationSchema }), authorize('manage'), asyncHandler(async (req, res) =>
  res.json(await service.updateOperation(req.valid.params.id, req.valid.body, req.user))));

// State transitions are explicit actions, not generic "PATCH status".
router.post('/:id/confirm', validate({ params: idParam }), authorize('process'), asyncHandler(async (req, res) =>
  res.json(await service.confirmOperation(req.valid.params.id, req.user))));
router.post('/:id/validate', validate({ params: idParam }), authorize('process'), asyncHandler(async (req, res) =>
  res.json(await service.validateOperation(req.valid.params.id, req.user))));
// Delivery picking (warehouse staff): pick quantities -> pack -> validate.
router.post('/:id/pick', validate({ params: idParam, body: s.pickSchema }), authorize('process'), asyncHandler(async (req, res) =>
  res.json(await service.pickDelivery(req.valid.params.id, req.valid.body, req.user))));
router.post('/:id/pack', validate({ params: idParam }), authorize('process'), asyncHandler(async (req, res) =>
  res.json(await service.packDelivery(req.valid.params.id, req.user))));
router.post('/:id/check-availability', validate({ params: idParam }), authorize('process'), asyncHandler(async (req, res) =>
  res.json(await service.checkAvailability(req.valid.params.id, req.user))));
router.post('/:id/cancel', validate({ params: idParam }), authorize('manage'), asyncHandler(async (req, res) =>
  res.json(await service.cancelOperation(req.valid.params.id, req.user))));

export default router;
