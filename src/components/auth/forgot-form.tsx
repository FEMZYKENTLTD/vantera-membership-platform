'use client';

import { useActionState } from 'react';
import { requestPasswordReset } from '@/lib/auth/actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, {});
  return (
    <form action={formAction} className="space-y-5">
      <Field label="Email address" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
      <FormStateMessage state={state} />
    </form>
  );
}
