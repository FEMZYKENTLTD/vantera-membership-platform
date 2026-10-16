'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/lib/auth/actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, {});
  return (
    <form action={formAction} className="space-y-5">
      <Field label="New password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Updating…">
        Update password
      </SubmitButton>
      <FormStateMessage state={state} />
    </form>
  );
}
