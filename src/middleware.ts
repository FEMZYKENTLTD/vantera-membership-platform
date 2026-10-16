import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all routes except static assets and public images so the auth
     * session is always fresh for server components and actions.
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|branding/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ]
};
