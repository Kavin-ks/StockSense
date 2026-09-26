import { z } from 'zod';

export const loginIdSchema = z
  .string({ required_error: 'Login ID is required' })
  .trim()
  .min(6, 'Login ID must be 6-12 characters')
  .max(12, 'Login ID must be 6-12 characters')
  .regex(/^[A-Za-z0-9_.]+$/, 'Login ID may only contain letters, numbers, "." and "_"');

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address');

// Mock-up rule: lower case + upper case + special character, more than 8 characters.
export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(9, 'Password must be more than 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const signupSchema = z
  .object({
    loginId: loginIdSchema,
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, 'Login ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: emailSchema,
});
