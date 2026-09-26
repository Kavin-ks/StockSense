import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { idParam, optionalId } from '../../utils/schemas.js';
import { requirePermission } from '../../middleware/auth.js';
import { warehouseSchema, locationSchema } from './warehouses.schemas.js';
import * as service from './warehouses.service.js';

export const warehouseRouter = Router();
export const locationRouter = Router();
const canWrite = requirePermission('settings.write');

const archivedQuery = z.object({ includeArchived: z.enum(['true', 'false']).optional().transform((v) => v === 'true') });
warehouseRouter.get('/', validate({ query: archivedQuery }), asyncHandler(async (req, res) =>
  res.json(await service.listWarehouses(req.valid.query))));
warehouseRouter.post('/:id/archive', canWrite, validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.setWarehouseActive(req.valid.params.id, false, req.user))));
warehouseRouter.post('/:id/restore', canWrite, validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.setWarehouseActive(req.valid.params.id, true, req.user))));
warehouseRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.getWarehouse(req.valid.params.id))));
warehouseRouter.post('/', canWrite, validate({ body: warehouseSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createWarehouse(req.valid.body, req.user))));
warehouseRouter.put('/:id', canWrite, validate({ params: idParam, body: warehouseSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateWarehouse(req.valid.params.id, req.valid.body, req.user))));

const locationQuery = z.object({
  warehouseId: optionalId,
  includeVirtual: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  includeArchived: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});
locationRouter.post('/:id/archive', canWrite, validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.setLocationActive(req.valid.params.id, false, req.user))));
locationRouter.post('/:id/restore', canWrite, validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.setLocationActive(req.valid.params.id, true, req.user))));
locationRouter.get('/', validate({ query: locationQuery }), asyncHandler(async (req, res) =>
  res.json(await service.listLocations(req.valid.query))));
locationRouter.post('/', canWrite, validate({ body: locationSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createLocation(req.valid.body, req.user))));
locationRouter.put('/:id', canWrite, validate({ params: idParam, body: locationSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateLocation(req.valid.params.id, req.valid.body, req.user))));
