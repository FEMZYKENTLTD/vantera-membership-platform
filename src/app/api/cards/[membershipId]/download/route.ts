import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser, getAdminContext } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';

/**
 * Authorised membership-card download.
 *
 * Flow: verify session → verify the caller owns the membership (or holds
 * cards.manage) → require the card to be in a downloadable state for
 * members → issue a SHORT-LIVED signed URL for the private storage bucket
 * and redirect. Card files are never public and never exposed by listing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId } = await params;
  const loginUrl = `${env.siteUrl()}/login?next=${encodeURIComponent('/portal/cards')}`;

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(loginUrl);

  const rl = checkRateLimit(`card-download:${user.id}`, 30, 3_600_000);
  if (!rl.ok) {
    return new NextResponse('Too many requests. Please try again later.', { status: 429 });
  }

  const ctx = await getAdminContext(user.id);
  const canManageCards = ctx?.permissions.has('cards.manage') ?? false;

  // RLS enforces: members read only their own memberships.
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('memberships')
    .select('id, user_id, status, membership_number')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) return new NextResponse('Not found', { status: 404 });

  if (membership.user_id !== user.id && !canManageCards) {
    return new NextResponse('Not found', { status: 404 }); // no IDOR oracle
  }

  const { data: card } = await supabase
    .from('membership_cards')
    .select('id, status, current_version_id')
    .eq('membership_id', membership.id)
    .maybeSingle();
  if (!card || !card.current_version_id) {
    return new NextResponse('No card design has been issued yet.', { status: 404 });
  }

  const requestedVersion = new URL(_request.url).searchParams.get('version');

  // Members may only download the CURRENT version and only when ready.
  if (!canManageCards && card.status !== 'ready') {
    return new NextResponse('Your card is not ready for download yet.', { status: 409 });
  }

  let versionQuery = supabase
    .from('membership_card_versions')
    .select('id, storage_path, file_name, mime_type')
    .eq('card_id', card.id)
    .limit(1);

  versionQuery =
    canManageCards && requestedVersion
      ? versionQuery.eq('id', requestedVersion)
      : versionQuery.eq('id', card.current_version_id);

  const { data: version } = await versionQuery.maybeSingle();
  if (!version) return new NextResponse('Not found', { status: 404 });

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from('membership-cards')
    .createSignedUrl(version.storage_path, 120, {
      download: version.file_name
    });
  if (error || !signed?.signedUrl) {
    return new NextResponse('Could not prepare the download.', { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
