import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';

/**
 * Authorised evidence file access. Evidence lives in a private bucket and is
 * granted via short-lived signed URLs only. Row Level Security performs the
 * ownership/permission check: members can read their own evidence rows and
 * reviewers (payments.review) can read all — anyone else gets 404, never a
 * hint that the object exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  const { evidenceId } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(`${env.siteUrl()}/login`);
  }

  const rl = checkRateLimit(`evidence:${user.id}`, 60, 3_600_000);
  if (!rl.ok) {
    return new NextResponse('Too many requests.', { status: 429 });
  }

  const supabase = await createClient();
  const { data: evidence } = await supabase
    .from('payment_evidence')
    .select('id, storage_bucket, storage_path, file_name')
    .eq('id', evidenceId)
    .maybeSingle();
  if (!evidence) return new NextResponse('Not found', { status: 404 });

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(evidence.storage_bucket)
    .createSignedUrl(evidence.storage_path, 120);
  if (error || !signed?.signedUrl) {
    return new NextResponse('Could not prepare the file.', { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
