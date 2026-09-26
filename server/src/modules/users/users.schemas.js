import { z } from 'zod';
import { ROLES } from '../../config/permissions.js';
import { pagination } from '../../utils/schemas.js';
import { emailSchema, loginIdSchema, passwordSchema } from '../auth/auth.schemas.js';

const role = z.enum(ROLES, { error: 'Role must be manager or staff' });

export const userListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: role.optional().or(z.literal('').transform(() => undefined)),
  status: z.enum(['active', 'inactive']).optional().or(z.literal('').transform(() => undefined)),
  ...pagination,
});

// A manager adds a team member with a temporary password they share out of band.
export const createUserSchema = z.object({
  loginId: loginIdSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: emailSchema,
  role: role.default('staff'),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  role: role.optional(),
  isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
}).refine((d) => d.role !== undefined || d.isActive !== undefined, { message: 'Nothing to update' });
