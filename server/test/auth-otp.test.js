import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { query } from '../src/db/pool.js';
import * as authService from '../src/modules/auth/auth.service.js';

test('Password Reset & Brevo OTP Flow Security Suite', async (t) => {
  const testEmail = 'test-otp-user@stocksense.local';
  const testLoginId = 'testuser123';
  const initialPassword = 'InitialPass@123';
  const newPassword = 'NewSecretPass@456';

  // Cleanup any leftover test data
  await query('DELETE FROM users WHERE email = $1 OR login_id = $2', [testEmail, testLoginId]);

  // Create test user
  const { user } = await authService.signup({
    loginId: testLoginId,
    name: 'Test OTP User',
    email: testEmail,
    password: initialPassword,
  });

  await t.test('Forgot password only accessible to existing users', async () => {
    // Non-existent email must be rejected
    await assert.rejects(async () => {
      await authService.requestPasswordReset({ email: 'nonexistent@stocksense.local' });
    }, /No account found with this email address/);

    // Valid existing email generates OTP and stores in DB
    await assert.doesNotReject(async () => {
      await authService.requestPasswordReset({ email: testEmail });
    });
  });

  await t.test('Signup requires and verifies OTP', async () => {
    const signupEmail = 'new-signup@stocksense.local';
    const signupLoginId = 'newsignup';
    await query('DELETE FROM users WHERE email = $1 OR login_id = $2', [signupEmail, signupLoginId]);

    // Request signup OTP
    await authService.requestSignupOtp({
      loginId: signupLoginId,
      name: 'New Signup User',
      email: signupEmail,
    });

    const { rows: signupOtps } = await query(
      'SELECT id, otp_hash FROM signup_otps WHERE lower(email) = $1 ORDER BY created_at DESC LIMIT 1',
      [signupEmail]
    );
    assert.equal(signupOtps.length, 1);

    // Set known OTP
    const knownSignupOtp = '739102';
    const knownSignupHash = await bcrypt.hash(knownSignupOtp, 10);
    await query('UPDATE signup_otps SET otp_hash = $1 WHERE id = $2', [knownSignupHash, signupOtps[0].id]);

    // Wrong OTP rejected
    await assert.rejects(async () => {
      await authService.signup({
        loginId: signupLoginId,
        name: 'New Signup User',
        email: signupEmail,
        password: 'ValidPassword@123',
        confirmPassword: 'ValidPassword@123',
        otp: '000000',
      });
    }, /Invalid or expired verification code/);

    // Valid OTP succeeds
    const newSignupUser = await authService.signup({
      loginId: signupLoginId,
      name: 'New Signup User',
      email: signupEmail,
      password: 'ValidPassword@123',
      confirmPassword: 'ValidPassword@123',
      otp: knownSignupOtp,
    });
    assert.ok(newSignupUser.token);
    assert.equal(newSignupUser.user.loginId, signupLoginId);

    // Cleanup signup test user
    await query('DELETE FROM users WHERE id = $1', [newSignupUser.user.id]);
  });

  await t.test('C, D, & F: OTP is generated, hashed with bcrypt, and stored in DB', async () => {
    const { rows } = await query(
      'SELECT id, otp_hash, attempts, expires_at, used_at FROM password_reset_otps WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    assert.equal(rows.length, 1);
    const otpRecord = rows[0];

    // OTP hash is stored and is a bcrypt hash
    assert.ok(otpRecord.otp_hash.startsWith('$2'));
    assert.equal(otpRecord.attempts, 0);
    assert.equal(otpRecord.used_at, null);
    assert.ok(new Date(otpRecord.expires_at) > new Date());
  });

  await t.test('I & J: Incorrect OTP increments attempts and enforces max attempts', async () => {
    const { rows: before } = await query(
      'SELECT id, attempts FROM password_reset_otps WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );
    const otpId = before[0].id;

    // 1st wrong attempt
    await assert.rejects(async () => {
      await authService.resetPassword({
        email: testEmail,
        otp: '000000',
        password: newPassword,
      });
    }, /Invalid or expired OTP/);

    const { rows: after1 } = await query('SELECT attempts FROM password_reset_otps WHERE id = $1', [otpId]);
    assert.equal(after1[0].attempts, 1);

    // Set attempts to 5 (max)
    await query('UPDATE password_reset_otps SET attempts = 5 WHERE id = $1', [otpId]);

    // Should reject immediately when attempts >= 5
    await assert.rejects(async () => {
      await authService.resetPassword({
        email: testEmail,
        otp: '000000',
        password: newPassword,
      });
    }, /Invalid or expired OTP/);
  });

  await t.test('H: Expired OTP is rejected', async () => {
    // Insert an expired OTP
    const expiredOtp = '123456';
    const expiredHash = await bcrypt.hash(expiredOtp, 10);
    await query(
      "INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES ($1, $2, now() - interval '5 minutes')",
      [user.id, expiredHash]
    );

    await assert.rejects(async () => {
      await authService.resetPassword({
        email: testEmail,
        otp: expiredOtp,
        password: newPassword,
      });
    }, /Invalid or expired OTP/);
  });

  await t.test('G, K, L, & M: Valid OTP updates password, marks used, and prevents replay', async () => {
    const validOtp = '654321';
    const validHash = await bcrypt.hash(validOtp, 10);
    await query(
      "INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [user.id, validHash]
    );

    // Reset password with valid OTP
    await authService.resetPassword({
      email: testEmail,
      otp: validOtp,
      password: newPassword,
    });

    // Check OTP record is now marked as used
    const { rows } = await query(
      'SELECT used_at FROM password_reset_otps WHERE user_id = $1 AND used_at IS NOT NULL',
      [user.id]
    );
    assert.ok(rows.length > 0);

    // Replay attack: Used OTP cannot be reused
    await assert.rejects(async () => {
      await authService.resetPassword({
        email: testEmail,
        otp: validOtp,
        password: 'AnotherPassword@789',
      });
    }, /Invalid or expired OTP/);

    // Verify login with new password works using Login ID
    const loginResult = await authService.login({
      loginId: testLoginId,
      password: newPassword,
    });
    assert.ok(loginResult.token);
    assert.equal(loginResult.user.loginId, testLoginId);

    // Verify login with new password works using case-insensitive Login ID
    const loginResultMixedId = await authService.login({
      loginId: testLoginId.toUpperCase(),
      password: newPassword,
    });
    assert.ok(loginResultMixedId.token);
    assert.equal(loginResultMixedId.user.loginId, testLoginId);

    // Verify login with new password works using Email
    const loginResultEmail = await authService.login({
      loginId: testEmail,
      password: newPassword,
    });
    assert.ok(loginResultEmail.token);
    assert.equal(loginResultEmail.user.loginId, testLoginId);

    // Verify login with new password works using Mixed-case Email
    const loginResultMixedEmail = await authService.login({
      loginId: 'Test-Otp-User@StockSense.Local',
      password: newPassword,
    });
    assert.ok(loginResultMixedEmail.token);
    assert.equal(loginResultMixedEmail.user.loginId, testLoginId);

    // Old password must fail
    await assert.rejects(async () => {
      await authService.login({
        loginId: testLoginId,
        password: initialPassword,
      });
    });
  });

  // Final cleanup
  await query('DELETE FROM users WHERE id = $1', [user.id]);
});
