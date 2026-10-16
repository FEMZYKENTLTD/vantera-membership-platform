'use client';

import { useActionState } from 'react';
import { cancelOrderAction } from '@/lib/admin/orders-actions';
import { ConfirmSubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(cancelOrderAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="Reason for cancellation (required)" htmlFor="reason">
        <Input id="reason" name="reason" maxLength={1000} required />
      </Field>
      <ConfirmSubmitButton
        variant="danger"
        confirmMessage="Cancel this order? The member will be notified."
      >
        Cancel order
      </ConfirmSubmitButton>
      <FormStateMessage state={state} />
    </form>
  );
}
