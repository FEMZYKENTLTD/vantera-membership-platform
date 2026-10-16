import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Typed readers for administrator-managed site_settings rows.
 * Readers validate the stored JSON with zod and fall back to safe,
 * disabled-by-default values so a malformed edit cannot break checkout.
 */

export const brandConfigSchema = z.object({
  name: z.string().default('Vantera'),
  tagline: z.string().default('A private circle, issued to a few.'),
  supportEmail: z.string().default(''),
  phone: z.string().default('')
});

export const contactConfigSchema = z.object({
  email: z.string().default(''),
  whatsapp: z.string().default(''),
  responseTime: z.string().default('We respond within 2 working days.')
});

export const cryptoNetworkSchema = z.object({
  asset: z.string().min(2).max(20),
  network: z.string().min(2).max(50),
  address: z.string().min(10).max(200),
  instructions: z.string().max(1000).default(''),
  confirmationsRequired: z.number().int().min(1).max(100).default(3)
});

export const cryptoPaymentsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  instructions: z.string().default(''),
  currencies: z.array(cryptoNetworkSchema).default([])
});

export const giftCardConfigSchema = z.object({
  enabled: z.boolean().default(false),
  instructions: z.string().default(''),
  reviewNotice: z.string().default(''),
  issuers: z.array(z.string().min(2).max(100)).default([])
});

export const verificationNoticeSchema = z.object({
  text: z
    .string()
    .default(
      'Payments are verified manually within 1–3 working days. Submitting payment information does not mean your payment has been approved.'
    )
});

export const businessVerificationSchema = z.object({
  workingDays: z.number().int().min(1).max(10).default(3),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([])
});

export const cardDisplaySettingsSchema = z.object({
  showTier: z.boolean().default(true),
  showExpiry: z.boolean().default(true)
});

export const dobPolicySchema = z.object({
  required: z.boolean().default(false),
  minimumAge: z.number().int().min(0).max(120).default(18),
  notice: z.string().default('')
});

export const retentionPolicySchema = z.object({
  inactiveAccountMonths: z.number().int().min(1).max(240).default(36),
  evidenceMonths: z.number().int().min(1).max(240).default(24),
  contact: z.string().default('')
});

export type BrandConfig = z.output<typeof brandConfigSchema>;
export type ContactConfig = z.output<typeof contactConfigSchema>;
export type CryptoPaymentsConfig = z.output<typeof cryptoPaymentsConfigSchema>;
export type GiftCardConfig = z.output<typeof giftCardConfigSchema>;
export type BusinessVerification = z.output<typeof businessVerificationSchema>;
export type CardDisplaySettings = z.output<typeof cardDisplaySettingsSchema>;
export type DobPolicy = z.output<typeof dobPolicySchema>;
export type RetentionPolicy = z.output<typeof retentionPolicySchema>;

async function readSetting<S extends z.ZodTypeAny>(
  key: string,
  schema: S
): Promise<z.output<S>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    const parsed = schema.safeParse(data?.value ?? {});
    return parsed.success ? parsed.data : schema.parse({});
  } catch {
    return schema.parse({});
  }
}

export const getBrandConfig = () => readSetting('brand', brandConfigSchema);
export const getContactConfig = () => readSetting('contact', contactConfigSchema);
export const getCryptoConfig = () =>
  readSetting('payments.crypto', cryptoPaymentsConfigSchema);
export const getGiftCardConfig = () =>
  readSetting('payments.gift_card', giftCardConfigSchema);
export const getVerificationNotice = () =>
  readSetting('payments.verification_notice', verificationNoticeSchema);
export const getBusinessVerification = () =>
  readSetting('business.verification', businessVerificationSchema);
export const getCardDisplaySettings = () =>
  readSetting('verification.card_display', cardDisplaySettingsSchema);
export const getDobPolicy = () =>
  readSetting('profile.require_date_of_birth', dobPolicySchema);
export const getRetentionPolicy = () =>
  readSetting('privacy.retention', retentionPolicySchema);

export function holidaySet(cfg: BusinessVerification): ReadonlySet<string> {
  return new Set(cfg.holidays);
}
