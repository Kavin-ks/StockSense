import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../utils/AppError.js';
import * as schemas from './auth.schemas.js';
import * as service from './auth.service.js';

const router = Router();
// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

router.post('/signup/send-otp', authLimiter, validate({ body: schemas.signupOtpRequestSchema }), asyncHandler(async (req, res) => {
  res.json(await service.requestSignupOtp(req.valid.body));
}));

router.post('/signup', authLimiter, validate({ body: schemas.signupSchema }), asyncHandler(async (req, res) => {
  if (!req.valid.body.otp) {
    throw AppError.badRequest('Verification code is required', { otp: 'Verification code is required' });
  }
  res.status(201).json(await service.signup(req.valid.body));
}));

router.post('/login', authLimiter, validate({ body: schemas.loginSchema }), asyncHandler(async (req, res) => {
  res.json(await service.login(req.valid.body));
}));

router.post('/forgot-password', authLimiter, validate({ body: schemas.forgotPasswordSchema }), asyncHandler(async (req, res) => {
  await service.requestPasswordReset(req.valid.body);
  res.json({ message: 'A verification code has been sent to your email.' });
}));

router.post('/reset-password', authLimiter, validate({ body: schemas.resetPasswordSchema }), asyncHandler(async (req, res) => {
  await service.resetPassword(req.valid.body);
  res.json({ message: 'Password updated. You can now sign in.' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json(await service.getProfile(req.user.id));
}));

router.put('/me', requireAuth, validate({ body: schemas.updateProfileSchema }), asyncHandler(async (req, res) => {
  res.json(await service.updateProfile(req.user.id, req.valid.body));
}));

export default router;
