import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getDobPolicy } from '@/lib/settings';
import { ProfileForm } from '@/components/portal/profile-form';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser('/portal/profile');
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  const dobPolicy = await getDobPolicy();

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Member portal</p>
        <h1 className="display-3 mt-2">Your profile</h1>
        <p className="mt-2 max-w-lg text-sm text-ivory-100/50">
          This information identifies your membership and personalises your
          card. We never display it publicly.
        </p>
      </div>

      {!profile?.full_name && (
        <Alert tone="warning" title="Complete your profile">
          Add your full legal name and contact details before submitting a
          payment — your card is personalised from this information.
        </Alert>
      )}

      <ProfileForm
        profile={profile}
        email={user.email}
        dobPolicy={{ required: dobPolicy.required, notice: dobPolicy.notice }}
      />
    </div>
  );
}
