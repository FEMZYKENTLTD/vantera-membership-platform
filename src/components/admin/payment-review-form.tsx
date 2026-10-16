'use client';

import { useActionState, useState } from 'react';
import { paymentReviewAction } from '@/lib/admin/payments-actions';
import { ConfirmSubmitButton, SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Textarea } from '@/components/ui/input';
import { CheckIcon, XIcon, ClockIcon, AlertIcon } from '@/components/icons';
import type { PaymentStatus } from '@/types/database';

export function PaymentReviewForm({
  paymentId,
  status,
  permissions
}: {
  paymentId: string;
  status: PaymentStatus;
  permissions: string[];
}) {
  const [state, formAction] = useActionState(paymentReviewAction, {});
  const [action, setAction] = useState<string>('');

  const canApprove = permissions.includes('payments.approve');
  const canReject = permissions.includes('payments.reject');

  if (status === 'approved' || status === 'rejected') {
    return (
      <p className="text-sm text-ivory-100/50">
        This payment has been {status} and is final. It cannot be processed again.
      </p>
    );
  }

  const needsReason = action === 'reject' || action === 'request_info';

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="paymentId" value={paymentId} />

      <Field
        label={
          needsReason
            ? 'Reason — required, shared with the member'
            : 'Note (optional, shared with the member)'
        }
        htmlFor="reason"
      >
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          maxLength={1000}
          placeholder={
            needsReason
              ? 'Explain clearly what is wrong or what is missing…'
              : 'Optional internal-facing note…'
          }
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        {status === 'pending_review' || status === 'submitted' ? (
          <SubmitButton
            variant="subtle"
            name="action"
            value="mark_under_review"
            onClick={() => setAction('mark_under_review')}
          >
            <ClockIcon /> Mark under review
          </SubmitButton>
        ) : null}

        {canApprove && (
          <ConfirmSubmitButton
            name="action"
            value="approve"
            confirmMessage="Approve this payment? This is final and will make the membership eligible for processing."
            onClick={() => setAction('approve')}
          >
            <CheckIcon /> Approve payment
          </ConfirmSubmitButton>
        )}

        {canReject && (
          <ConfirmSubmitButton
            variant="danger"
            name="action"
            value="reject"
            confirmMessage="Reject this payment? The member will be notified with your reason. This is final."
            onClick={() => setAction('reject')}
          >
            <XIcon /> Reject
          </ConfirmSubmitButton>
        )}

        <SubmitButton
          variant="secondary"
          name="action"
          value="request_info"
          onClick={() => setAction('request_info')}
        >
          <AlertIcon /> Request more information
        </SubmitButton>
      </div>

      {action === '' && (
        <p className="text-xs text-ivory-100/35">
          Approval and rejection ask for confirmation and are permanently recorded with your
          identity and reason.
        </p>
      )}
      <FormStateMessage state={state} />
    </form>
  );
}
