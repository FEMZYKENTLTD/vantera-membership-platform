import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResetPasswordForm } from '@/components/auth/reset-form';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ShieldIcon, LogoutIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Security' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage({
  searchParams
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const user = await requireUser('/portal/security');
  const { updated } = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Member portal</p>
        <h1 className="display-3 mt-2">Account security</h1>
        <p className="mt-2 max-w-lg text-sm text-ivory-100/50">{user.email}</p>
      </div>

      {updated === 'password' && (
        <Alert tone="success">Your password has been updated.</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Choose a strong, unique password at least 8 characters long.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Your sign-in session is protected</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="flex items-start gap-3 text-sm leading-relaxed text-ivory-100/55">
                <ShieldIcon className="mt-0.5 size-4 shrink-0 text-gold-400" />
                Sessions use secure, HTTP-only cookies and are validated on the
                server for every private page and action. Sign out on shared
                devices.
              </p>
              <form action="/auth/signout" method="post">
                <Button variant="secondary">
                  <LogoutIcon /> Sign out of this device
                </Button>
              </form>
            </CardContent>
          </Card>

          <Alert tone="info" title="Stay safe">
            Vantera will never ask for gift-card PINs, redemption codes, wallet
            private keys or seed phrases — in email, chat, or on this site. If
            anyone does, it is not us.
          </Alert>
        </div>
      </div>
    </div>
  );
}
