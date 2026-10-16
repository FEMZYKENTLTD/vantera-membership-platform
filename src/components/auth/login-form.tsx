'use client';

import { useActionState } from 'react';
import { loginAccount } from '@/lib/auth/actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction] = useActionState(loginAccount, {});
  return (
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email address" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <FormStateMessage state={state} />
    </form>
  );
}
