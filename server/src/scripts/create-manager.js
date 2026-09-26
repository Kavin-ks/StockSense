/**
 * Bootstrap (or reset) the first Inventory Manager without committing credentials.
 *
 * Reads MANAGER_LOGIN_ID, MANAGER_NAME, MANAGER_EMAIL, MANAGER_PASSWORD from server/.env
 * (git-ignored). Idempotent:
 *   - no user with that login id -> creates a manager
 *   - user exists               -> promotes to manager, re-activates, and sets the password
 * Usage: npm run create-manager
 */
import { z } from 'zod';
import '../config/zod.js';
import { pool, query } from '../db/pool.js';
import { emailSchema, loginIdSchema, passwordSchema } from '../modules/auth/auth.schemas.js';
import { hashPassword } from '../modules/auth/auth.service.js';

const schema = z.object({
  MANAGER_LOGIN_ID: loginIdSchema,
  MANAGER_NAME: z.string().trim().min(2, 'MANAGER_NAME must be at least 2 characters'),
  MANAGER_EMAIL: emailSchema,
  MANAGER_PASSWORD: passwordSchema,
});

async function main() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Set these in server/.env first:');
    for (const issue of parsed.error.issues) console.error(`  ${issue.path[0]}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }
  const { MANAGER_LOGIN_ID: loginId, MANAGER_NAME: name, MANAGER_EMAIL: email, MANAGER_PASSWORD: password } = parsed.data;
  const hash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (login_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'manager')
     ON CONFLICT (login_id) DO UPDATE
       SET role = 'manager', is_active = TRUE, name = EXCLUDED.name, email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash, updated_at = now()
     RETURNING (xmax = 0) AS created`,
    [loginId, name, email, hash],
  );
  console.log(`${rows[0].created ? 'Created' : 'Updated'} manager "${loginId}". Sign in and add staff under Settings → Users.`);
}

main()
  .catch((err) => {
    console.error(err.code === '23505' ? 'That email is already used by another account.' : err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
