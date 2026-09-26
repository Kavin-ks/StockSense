import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/auth.js';
import { idParam, paged } from '../../utils/schemas.js';
import * as s from './users.schemas.js';
import * as service from './users.service.js';

const router = Router();
router.use(requirePermission('users.manage'));

router.get('/', validate({ query: s.userListQuery }), asyncHandler(async (req, res) => {
  const { rows, total, pendingCount } = await service.listUsers(req.valid.query);
  res.json({ ...paged(rows, total, req.valid.query), pendingCount });
}));
// Small endpoint for the "N waiting" badge in the navigation.
router.get('/pending-count', asyncHandler(async (_req, res) => res.json({ count: await service.pendingCount() })));

router.post('/', validate({ body: s.createUserSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createUser(req.valid.body, req.user))));
router.post('/:id/approve', validate({ params: idParam, body: s.approveUserSchema }), asyncHandler(async (req, res) =>
  res.json(await service.approveUser(req.valid.params.id, req.valid.body, req.user))));
router.post('/:id/reject', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.rejectUser(req.valid.params.id, req.user);
  res.status(204).end();
}));
router.patch('/:id', validate({ params: idParam, body: s.updateUserSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateUser(req.valid.params.id, req.valid.body, req.user))));

export default router;
