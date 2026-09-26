import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { idParam, optionalId } from '../../utils/schemas.js';
import { warehouseSchema, locationSchema } from './warehouses.schemas.js';
import * as service from './warehouses.service.js';

export const warehouseRouter = Router();
export const locationRouter = Router();

warehouseRouter.get('/', asyncHandler(async (_req, res) => res.json(await service.listWarehouses())));
warehouseRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await service.getWarehouse(req.valid.params.id))));
warehouseRouter.post('/', validate({ body: warehouseSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createWarehouse(req.valid.body))));
warehouseRouter.put('/:id', validate({ params: idParam, body: warehouseSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateWarehouse(req.valid.params.id, req.valid.body))));

const locationQuery = z.object({
  warehouseId: optionalId,
  includeVirtual: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});
locationRouter.get('/', validate({ query: locationQuery }), asyncHandler(async (req, res) =>
  res.json(await service.listLocations(req.valid.query))));
locationRouter.post('/', validate({ body: locationSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createLocation(req.valid.body))));
locationRouter.put('/:id', validate({ params: idParam, body: locationSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateLocation(req.valid.params.id, req.valid.body))));
