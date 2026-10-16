'use client';

import { useActionState } from 'react';
import { createOrderAction } from '@/lib/portal/actions';
import { SubmitButton, FormStateMessage } from '@/components/ui/form';

/**
 * "Select this membership" — creates a server-priced order for the signed-in
 * member. Unauthenticated visitors are redirected to sign in first.
 */
export function SelectTierButton({ tierId }: { tierId: string }) {
  const [state, formAction] = useActionState(createOrderAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tierId" value={tierId} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Creating your order…">
        Select this membership
      </SubmitButton>
      <FormStateMessage state={state} />
    </form>
  );
}
