import { z } from 'zod';

/**
 * Server-side validation schemas. Every mutation entry point validates with
 * these — client-side validation exists only for convenience.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full legal name')
  .max(200, 'Name is too long')
  .regex(/^[^\p{C}]*$/u, 'Name contains invalid characters');

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null));

export const uuidSchema = z.string().uuid('Invalid identifier');

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO currency code, e.g. USD');

/** ISO date (YYYY-MM-DD) that is real, after 1900, and not in the future. */
export const pastDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Enter a real calendar date')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return d > new Date('1900-01-01T00:00:00Z') && d.getTime() < Date.now();
  }, 'Date of birth must be a real past date');

function ageOn(dobIso: string, at: Date): number {
  const dob = new Date(`${dobIso}T00:00:00Z`);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const before =
    at.getUTCMonth() < dob.getUTCMonth() ||
    (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate());
  if (before) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128)
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match'
  });

// ---------------------------------------------------------------------------
// Profile (never collect more than membership administration needs)
// ---------------------------------------------------------------------------

export const profileUpdateSchema = z.object({
  fullName: nameSchema,
  phone: optionalTrimmed(40),
  addressLine1: optionalTrimmed(200),
  addressLine2: optionalTrimmed(200),
  city: optionalTrimmed(100),
  region: optionalTrimmed(100),
  postalCode: optionalTrimmed(20),
  country: optionalTrimmed(100),
  dateOfBirth: z
    .union([z.literal(''), pastDateSchema])
    .optional()
    .transform((v) => (v ? v : null))
});

/**
 * Enforce the administrator-configured date-of-birth policy.
 * When required, a valid DOB meeting the minimum age must be present.
 */
export function checkDobPolicy(
  dob: string | null,
  policy: { required: boolean; minimumAge: number }
): string | null {
  if (policy.required && !dob) {
    return 'Date of birth is required for membership eligibility.';
  }
  if (dob && ageOn(dob, new Date()) < policy.minimumAge) {
    return `Members must be at least ${policy.minimumAge} years old.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Orders & payments
// ---------------------------------------------------------------------------

export const createOrderSchema = z.object({ tierId: uuidSchema });

export const txHashSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9]{8,128}$/, 'Enter a valid transaction hash')
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

const notesSchema = z
  .string()
  .trim()
  .max(2000, 'Notes must be under 2000 characters')
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

export const cryptoPaymentSchema = z
  .object({
    orderId: uuidSchema,
    cryptoCurrency: z.string().trim().min(2).max(20),
    network: z.string().trim().min(2).max(50),
    expectedAmount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,8})?$/, 'Enter a valid amount (up to 8 decimals)')
      .refine((s) => Number(s) > 0, 'Amount must be positive'),
    txHash: txHashSchema.optional(),
    paidAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Invalid date')
      .or(z.literal(''))
      .optional()
      .transform((v) => (v ? v : null))
      .refine(
        (v) => !v || new Date(v).getTime() <= Date.now() + 5 * 60 * 1000,
        'Payment time cannot be in the future'
      ),
    notes: notesSchema.optional()
  })
  .strict();

/**
 * Gift-card submissions NEVER include card PINs, redemption codes or claim
 * codes — .strict() rejects any unexpected field and reviewers never see one.
 */
export const giftCardPaymentSchema = z
  .object({
    orderId: uuidSchema,
    issuer: z.string().trim().min(2, 'Enter the gift-card issuer').max(100),
    denomination: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount'),
    currency: currencySchema,
    purchaseReference: z
      .string()
      .trim()
      .max(120, 'Reference is too long')
      .or(z.literal(''))
      .optional()
      .transform((v) => (v ? v : null)),
    notes: notesSchema.optional()
  })
  .strict();

/** Re-submission: the member corrects the SAME payment row (by id), not a new one. */
export const cryptoResubmitSchema = cryptoPaymentSchema
  .omit({ orderId: true })
  .extend({ paymentId: uuidSchema })
  .strict();

export const giftCardResubmitSchema = giftCardPaymentSchema
  .omit({ orderId: true })
  .extend({ paymentId: uuidSchema })
  .strict();

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

export const reviewActionSchema = z.object({
  paymentId: uuidSchema,
  action: z.enum(['mark_under_review', 'approve', 'reject', 'request_info']),
  reason: z
    .string()
    .trim()
    .max(1000, 'Reason must be under 1000 characters')
    .or(z.literal(''))
    .optional()
    .transform((v) => (v ? v : null))
});

export const membershipActionSchema = z.object({
  membershipId: uuidSchema,
  action: z.enum([
    'start_processing',
    'activate',
    'suspend',
    'revoke',
    'reinstate',
    'cancel',
    'expire'
  ]),
  reason: z
    .string()
    .trim()
    .max(1000)
    .or(z.literal(''))
    .optional()
    .transform((v) => (v ? v : null))
});

export const customerStatusSchema = z.object({
  userId: uuidSchema,
  status: z.enum(['active', 'suspended']),
  reason: z
    .string()
    .trim()
    .max(1000)
    .or(z.literal(''))
    .optional()
    .transform((v) => (v ? v : null))
});

export const orderCancelSchema = z.object({
  orderId: uuidSchema,
  reason: z.string().trim().min(5, 'A reason is required').max(1000)
});

const benefitsInput = z
  .string()
  .transform((s) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.string().min(2).max(200)).max(30));

export const packageSchema = z
  .object({
    id: z.union([uuidSchema, z.literal('')]).transform((v) => (v ? v : null)),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes'),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000),
    price: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid price, e.g. 1000 or 1000.00'),
    currency: currencySchema,
    displayOrder: z.coerce.number().int().min(0).max(1000),
    isPublished: z.coerce.boolean(),
    durationMonths: z
      .union([z.literal(''), z.coerce.number().int().min(1).max(1200)])
      .transform((v) => (v === '' ? null : v)),
    benefits: benefitsInput,
    terms: z.string().trim().max(5000)
  })
  .refine((v) => Number(v.price) >= 0, { path: ['price'], message: 'Invalid price' });

export const roleGrantSchema = z.object({
  email: emailSchema,
  roleKey: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{1,40}$/, 'Invalid role key'),
  permissions: z.array(z.string().min(2).max(60)).max(50)
});

export const roleUpdateSchema = z.object({
  roleId: uuidSchema,
  permissions: z.array(z.string().min(2).max(60)).max(50).optional(),
  isActive: z.coerce.boolean().optional()
});

export const settingUpdateSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9._-]{1,80}$/, 'Invalid setting key'),
  value: z.string().trim().min(2, 'Provide a JSON value').max(20000),
  isPublic: z.coerce.boolean()
});

export const publicIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/, 'Invalid verification code');

export const contactFormSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: emailSchema,
  message: z.string().trim().min(10, 'Tell us a little more').max(5000)
});
