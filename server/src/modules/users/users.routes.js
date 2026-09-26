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
  const { rows, total } = await service.listUsers(req.valid.query);
  res.json(paged(rows, total, req.valid.query));
}));
router.post('/', validate({ body: s.createUserSchema }), asyncHandler(async (req, res) =>
  res.status(201).json(await service.createUser(req.valid.body, req.user))));
router.patch('/:id', validate({ params: idParam, body: s.updateUserSchema }), asyncHandler(async (req, res) =>
  res.json(await service.updateUser(req.valid.params.id, req.valid.body, req.user))));

export default router;
