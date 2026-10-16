'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { settingUpdateSchema } from '@/lib/validation/schemas';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';
import type { Json } from '@/types/database';

export interface AdminActionState {
  error?: string;
  success?: string;
}

/**
 * Only known configuration keys may be written through the settings UI.
 * Note: receiving wallet addresses ARE configuration (public, like an
 * invoice) — never private keys or seed phrases, which the platform never
 * accepts anywhere.
 */
const ALLOWED_KEYS = new Set([
  'brand',
  'contact',
  'payments.crypto',
  'payments.gift_card',
  'payments.verification_notice',
  'business.verification',
  'verification.card_display',
  'profile.require_date_of_birth',
  'privacy.retention'
]);

/** Keys whose rows must never become publicly readable. */
const NEVER_PUBLIC = new Set(['profile.require_date_of_birth']);

export async function updateSettingAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const parsed = settingUpdateSchema.safeParse({
    key: formData.get('key'),
    value: formData.get('value'),
    isPublic: formData.get('isPublic')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid setting.' };
  }
  const { key, value, isPublic } = parsed.data;

  if (!ALLOWED_KEYS.has(key)) {
    return { error: 'That setting cannot be edited from the dashboard.' };
  }
  if (NEVER_PUBLIC.has(key) && isPublic) {
    return { error: 'This setting must never be publicly readable.' };
  }

  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return { error: 'The value must be valid JSON.' };
  }
  if (json === null || typeof json !== 'object') {
    return { error: 'The value must be a JSON object or array.' };
  }
  const jsonValue = json as Json;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('site_settings')
    .select('is_public')
    .eq('key', key)
    .maybeSingle();

  const { error } = await admin.from('site_settings').upsert(
    {
      key,
      value: jsonValue,
      is_public: isPublic,
      updated_by: ctx.user.id
    },
    { onConflict: 'key' }
  );
  if (error) return { error: 'The setting could not be saved.' };

  // Audit the change WITHOUT storing the full value where it could contain
  // operational details (addresses, instructions); the key + publicity flag
  // is enough for the trail. Never log secrets anywhere.
  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: 'settings.updated',
    entityType: 'site_setting',
    entityId: null,
    metadata: { key, isPublic }
  });

  revalidatePath('/admin/settings');
  return { success: `Setting "${key}" saved.` };
}

export interface SettingsOverviewRow {
  key: string;
  value: unknown;
  description: string;
  is_public: boolean;
}
export type { SettingsOverviewRow as _SettingsOverviewRow };
