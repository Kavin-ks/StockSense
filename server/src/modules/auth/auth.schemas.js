import { z } from 'zod';

export const loginIdSchema = z
  .string({ error: 'Login ID is required' })
  .trim()
  .min(6, 'Login ID must be 6-12 characters')
  .max(12, 'Login ID must be 6-12 characters')
  .regex(/^[A-Za-z0-9_.]+$/, 'Login ID may only contain letters, numbers, "." and "_"');

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address');

// Mock-up rule: lower case + upper case + special character, more than 8 characters.
export const passwordSchema = z
  .string({ error: 'Password is required' })
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
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits').optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const signupOtpRequestSchema = z
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
  loginId: z.string().trim().min(1, 'Login ID or Email is required'),
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

const optionalText = (max, label) => z.string().trim().max(max, `${label} must be at most ${max} characters`).optional().default('');

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: emailSchema,
  phone: optionalText(30, 'Phone').refine((v) => v === '' || /^\+?[0-9 ()-]{7,}$/.test(v), 'Enter a valid phone number'),
  department: optionalText(80, 'Department'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

// Every key optional: the client sends only what changed (PATCH semantics on a PUT of the prefs document).
export const preferencesSchema = z.object({
  defaultWarehouseId: z.coerce.number().int().positive().nullable().optional(),
  landingPage: z.enum(['/', '/operations/receipts', '/operations/deliveries', '/operations/transfers', '/stock'], {
    error: 'Choose a valid starting page',
  }).optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'], { error: 'Choose a valid date format' }).optional(),
  numberFormat: z.enum(['standard', 'european'], { error: 'Choose a valid number format' }).optional(),
  notifications: z.object({
    lowStock: z.boolean().optional(),
    receipts: z.boolean().optional(),
    deliveries: z.boolean().optional(),
    adjustments: z.boolean().optional(),
    dailyDigest: z.boolean().optional(),
  }).strict().optional(),
}).strict();
