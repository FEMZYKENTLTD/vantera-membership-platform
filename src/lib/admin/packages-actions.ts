'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { packageSchema, uuidSchema } from '@/lib/validation/schemas';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit, tryAudit } from '@/lib/audit/log';
import { toMinorUnits, fromMinorUnits } from '@/lib/payments/pricing';

export interface AdminActionState {
  error?: string;
  success?: string;
}

/**
 * Create or update a membership package. Existing orders keep their own
 * price snapshots — changing a price here NEVER mutates an existing order.
 * The database trigger additionally audits every price change.
 */
export async function upsertPackageAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.PACKAGES_MANAGE);

  const parsed = packageSchema.safeParse({
    id: formData.get('id'),
    slug: formData.get('slug'),
    name: formData.get('name'),
    description: formData.get('description'),
    price: formData.get('price'),
    currency: formData.get('currency'),
    displayOrder: formData.get('displayOrder'),
    isPublished: formData.get('isPublished'),
    durationMonths: formData.get('durationMonths'),
    benefits: formData.get('benefits'),
    terms: formData.get('terms')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the package form.' };
  }

  let price: string;
  try {
    price = fromMinorUnits(toMinorUnits(parsed.data.price));
  } catch {
    return { error: 'Enter a valid price.' };
  }

  const admin = createAdminClient();
  const values = {
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description,
    price,
    currency: parsed.data.currency,
    display_order: parsed.data.displayOrder,
    is_published: parsed.data.isPublished,
    duration_months: parsed.data.durationMonths,
    benefits: parsed.data.benefits,
    terms: parsed.data.terms
  };

  if (parsed.data.id) {
    const { data: existing } = await admin
      .from('membership_tiers')
      .select('price, currency, name')
      .eq('id', parsed.data.id)
      .maybeSingle();
    const { error } = await admin
      .from('membership_tiers')
      .update(values)
      .eq('id', parsed.data.id);
    if (error) {
      return {
        error: error.code === '23505'
          ? 'Another package already uses that URL slug.'
          : 'The package could not be saved.'
      };
    }
    await tryAudit(admin, {
      actorId: ctx.user.id,
      action: 'package.updated',
      entityType: 'membership_tier',
      entityId: parsed.data.id,
      previousState: existing ? `${existing.price} ${existing.currency}` : null,
      newState: `${price} ${parsed.data.currency}`,
      metadata: { name: parsed.data.name }
    });
  } else {
    const { data: inserted, error } = await admin
      .from('membership_tiers')
      .insert(values)
      .select('id')
      .single();
    if (error || !inserted) {
      return {
        error: error?.code === '23505'
          ? 'Another package already uses that URL slug.'
          : 'The package could not be created.'
      };
    }
    await tryAudit(admin, {
      actorId: ctx.user.id,
      action: 'package.created',
      entityType: 'membership_tier',
      entityId: inserted.id,
      newState: `${price} ${parsed.data.currency}`,
      metadata: { name: parsed.data.name }
    });
  }

  revalidatePath('/admin/packages');
  revalidatePath('/membership');
  return { success: 'Package saved.' };
}

export async function togglePackagePublishedAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.PACKAGES_MANAGE);
  const idParsed = uuidSchema.safeParse(formData.get('id'));
  if (!idParsed.success) return { error: 'Invalid package.' };

  const admin = createAdminClient();
  const { data: tier } = await admin
    .from('membership_tiers')
    .select('id, is_published, name')
    .eq('id', idParsed.data)
    .maybeSingle();
  if (!tier) return { error: 'Package not found.' };

  const { error } = await admin
    .from('membership_tiers')
    .update({ is_published: !tier.is_published })
    .eq('id', tier.id);
  if (error) return { error: 'The package could not be updated.' };

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: tier.is_published ? 'package.unpublished' : 'package.published',
    entityType: 'membership_tier',
    entityId: tier.id,
    metadata: { name: tier.name }
  });

  revalidatePath('/admin/packages');
  revalidatePath('/membership');
  return { success: tier.is_published ? 'Package unpublished.' : 'Package published.' };
}
