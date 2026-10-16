import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

/**
 * Supabase Auth callback — completes email confirmation and password
 * recovery flows by exchanging the one-time code for a session.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const destination = safeNext ?? (type === 'recovery' ? '/reset-password' : '/portal');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${env.siteUrl()}${destination}`);
    }
  }

  return NextResponse.redirect(`${env.siteUrl()}/login?error=callback`);
}
