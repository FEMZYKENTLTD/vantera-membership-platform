'use client';

import { useActionState } from 'react';
import { setCustomerStatusAction } from '@/lib/admin/customers-actions';
import { ConfirmSubmitButton, SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { ProfileStatus } from '@/types/database';

export function CustomerStatusForm({
  userId,
  status
}: {
  userId: string;
  status: ProfileStatus;
}) {
  const [state, formAction] = useActionState(setCustomerStatusAction, {});
  const next = status === 'active' ? 'suspended' : 'active';

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
      <Field
        label={next === 'suspended' ? 'Reason for suspension (required)' : 'Note (optional)'}
        htmlFor="reason"
      >
        <Input id="reason" name="reason" maxLength={1000} />
      </Field>
      {next === 'suspended' ? (
        <ConfirmSubmitButton
          variant="danger"
          confirmMessage="Suspend this account? The customer will see a suspension notice."
        >
          Suspend account
        </ConfirmSubmitButton>
      ) : (
        <SubmitButton variant="secondary">Reinstate account</SubmitButton>
      )}
      <FormStateMessage state={state} />
    </form>
  );
}
