import { z } from 'zod';
import { ROLES } from '../../config/permissions.js';
import { pagination } from '../../utils/schemas.js';
import { emailSchema, loginIdSchema, passwordSchema } from '../auth/auth.schemas.js';

const role = z.enum(ROLES, { error: 'Role must be manager or staff' });
const emptyToUndef = (schema) => schema.optional().or(z.literal('').transform(() => undefined));

export const userListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: emptyToUndef(role),
  status: emptyToUndef(z.enum(['pending', 'active', 'deactivated'])),
  ...pagination,
});

// A manager adds a team member directly (active at once) with a temporary password shared out of band.
export const createUserSchema = z.object({
  loginId: loginIdSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: emailSchema,
  role: role.default('staff'),
  password: passwordSchema,
});

// Approving a sign-up: the manager may grant manager access at the same time.
export const approveUserSchema = z.object({ role: role.default('staff') });

// Changes for accounts that are already approved (pending ones go through approve/reject).
export const updateUserSchema = z.object({
  role: role.optional(),
  status: z.enum(['active', 'deactivated'], { error: 'Status must be active or deactivated' }).optional(),
}).refine((d) => d.role !== undefined || d.status !== undefined, { message: 'Nothing to update' });
