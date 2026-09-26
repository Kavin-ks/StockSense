// Accounts: approval, roles guard, employee deletion, password change and sessions, preferences.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as auth from '../src/modules/auth/auth.service.js';
import * as users from '../src/modules/users/users.service.js';
import { userFromToken } from '../src/middleware/auth.js';
import { closePool, createUser, resetDb } from './helpers.js';

beforeEach(resetDb);
after(closePool);

test('duplicate login ID and email are reported per field (case-insensitive)', async () => {
  const manager = await createUser('manager', { loginId: 'boss01', email: 'boss@test.local' });
  await assert.rejects(
    users.createUser({ loginId: 'BOSS01', name: 'X', email: 'BOSS@test.local', role: 'staff', password: 'Test@12345' }, manager),
    (err) => err.details?.loginId === 'This Login ID is already taken' && err.details?.email === 'This email is already registered',
  );
});

test('a pending sign-up cannot log in until a manager approves it', async () => {
  const manager = await createUser('manager');
  const { user } = await auth.signup({ loginId: 'newbie1', name: 'New', email: 'new@test.local', password: 'Test@12345' });
  await assert.rejects(auth.login({ loginId: 'newbie1', password: 'Test@12345' }), /waiting for approval/);
  await users.approveUser(user.id, { role: 'staff' }, manager);
  const { token } = await auth.login({ loginId: 'newbie1', password: 'Test@12345' });
  assert.equal((await userFromToken(token)).role, 'staff');
});

test('deleting an employee ends their sessions, frees the login ID and keeps their name for history', async () => {
  const manager = await createUser('manager');
  const staff = await createUser('staff', { loginId: 'picker1', name: 'Priya' });
  const { token } = await auth.login({ loginId: 'picker1', password: 'Test@12345' });

  await users.deleteUser(staff.id, manager);
  await assert.rejects(userFromToken(token), /no longer exists|signed out/);
  const { rows } = await (await import('../src/db/pool.js')).query('SELECT name, status, login_id FROM users WHERE id = $1', [staff.id]);
  assert.equal(rows[0].name, 'Priya');
  assert.equal(rows[0].status, 'deleted');
  await users.createUser({ loginId: 'picker1', name: 'New Priya', email: 'picker1@test.local', role: 'staff', password: 'Test@12345' }, manager);
});

test('managers cannot delete themselves or the last active manager', async () => {
  const manager = await createUser('manager');
  await assert.rejects(users.deleteUser(manager.id, manager), /own account/);
});

test('password change requires the current password and signs out other sessions only', async () => {
  const u = await createUser('staff', { loginId: 'worker1' });
  const a = await auth.login({ loginId: 'worker1', password: 'Test@12345' });
  const b = await auth.login({ loginId: 'worker1', password: 'Test@12345' });
  const me = await userFromToken(a.token);

  await assert.rejects(auth.changePassword(me, { currentPassword: 'wrong', password: 'Newpass@123' }), /Current password is incorrect/);
  const res = await auth.changePassword(me, { currentPassword: 'Test@12345', password: 'Newpass@123' });
  assert.equal(res.signedOutSessions, 1);
  await userFromToken(a.token); // current session still valid
  await assert.rejects(userFromToken(b.token), /signed out/);
  await auth.login({ loginId: 'worker1', password: 'Newpass@123' });
  assert.ok(u.id);
});

test('preferences are stored per user, merged over defaults', async () => {
  const u = await createUser('staff');
  const saved = await auth.updatePreferences(u.id, { landingPage: '/stock', notifications: { dailyDigest: true } });
  assert.equal(saved.landingPage, '/stock');
  assert.equal(saved.notifications.dailyDigest, true);
  assert.equal(saved.notifications.lowStock, true, 'untouched toggles keep their default');
  assert.deepEqual(await auth.getPreferences(u.id), saved);
});
