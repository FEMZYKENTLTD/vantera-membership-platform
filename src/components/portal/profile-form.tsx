'use client';

import { useActionState } from 'react';
import { updateProfileAction } from '@/lib/portal/actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ProfileRow } from '@/types/database';

export function ProfileForm({
  profile,
  email,
  dobPolicy
}: {
  profile: ProfileRow | null;
  email: string | null;
  dobPolicy: { required: boolean; notice: string };
}) {
  const [state, formAction] = useActionState(updateProfileAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Your legal identity as it should appear on your card.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Full legal name" htmlFor="fullName" required className="md:col-span-2">
            <Input
              id="fullName"
              name="fullName"
              defaultValue={profile?.full_name ?? ''}
              autoComplete="name"
              required
              maxLength={200}
            />
          </Field>
          <Field label="Email address" htmlFor="email" hint="Managed through account security.">
            <Input id="email" value={email ?? ''} disabled readOnly />
          </Field>
          <Field label="Phone number" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              defaultValue={profile?.phone ?? ''}
              autoComplete="tel"
              maxLength={40}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mailing address</CardTitle>
          <CardDescription>Used only where membership administration requires it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Address line 1" htmlFor="addressLine1" className="md:col-span-2">
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={profile?.address_line1 ?? ''}
              autoComplete="address-line1"
              maxLength={200}
            />
          </Field>
          <Field label="Address line 2" htmlFor="addressLine2" className="md:col-span-2">
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={profile?.address_line2 ?? ''}
              autoComplete="address-line2"
              maxLength={200}
            />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={profile?.city ?? ''} maxLength={100} />
          </Field>
          <Field label="State / region" htmlFor="region">
            <Input id="region" name="region" defaultValue={profile?.region ?? ''} maxLength={100} />
          </Field>
          <Field label="Postal code" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={profile?.postal_code ?? ''}
              maxLength={20}
            />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input
              id="country"
              name="country"
              defaultValue={profile?.country ?? ''}
              autoComplete="country-name"
              maxLength={100}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Date of birth</CardTitle>
          <CardDescription>
            {dobPolicy.required
              ? 'Required for membership eligibility verification.'
              : 'Optional. Collected only if an age-eligibility policy is approved.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dobPolicy.notice && (
            <p className="rounded-md border border-info/30 bg-info/5 px-4 py-3 text-xs leading-relaxed text-[#B9C9E0]">
              {dobPolicy.notice}
            </p>
          )}
          <Field
            label={dobPolicy.required ? 'Date of birth (required)' : 'Date of birth (optional)'}
            htmlFor="dateOfBirth"
            hint={
              profile?.date_of_birth
                ? 'Already provided. Enter a new date only to correct it.'
                : 'Never displayed publicly and never printed on your card.'
            }
          >
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={profile?.date_of_birth ?? ''}
              required={dobPolicy.required}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </div>
      <FormStateMessage state={state} />
    </form>
  );
}
