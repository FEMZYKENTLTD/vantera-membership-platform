'use client';

import { useActionState } from 'react';
import { registerAccount } from '@/lib/auth/actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAccount, {});
  return (
    <form action={formAction} className="space-y-5">
      <Field label="Full legal name" htmlFor="fullName" required>
        <Input id="fullName" name="fullName" autoComplete="name" required maxLength={200} />
      </Field>
      <Field label="Email address" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        required
        hint="At least 8 characters. Use a unique password you do not reuse elsewhere."
      >
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
      <SubmitButton className="w-full" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
      <FormStateMessage state={state} />
      <p className="text-xs leading-relaxed text-ivory-100/40">
        By creating an account you agree to the{' '}
        <a href="/terms" className="underline underline-offset-2 hover:text-ivory-100/70">
          membership terms
        </a>{' '}
        and acknowledge our{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-ivory-100/70">
          privacy policy
        </a>
        . We use your details only to administer your membership.
      </p>
    </form>
  );
}
