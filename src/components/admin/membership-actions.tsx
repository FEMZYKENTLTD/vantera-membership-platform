'use client';

import { useActionState } from 'react';
import { membershipLifecycleAction } from '@/lib/admin/memberships-actions';
import { ConfirmSubmitButton, SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import type { MembershipStatus } from '@/types/database';

export function MembershipActions({
  membershipId,
  status,
  cardReady,
  paymentApproved
}: {
  membershipId: string;
  status: MembershipStatus;
  cardReady: boolean;
  paymentApproved: boolean;
}) {
  const [state, formAction] = useActionState(membershipLifecycleAction, {});

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="membershipId" value={membershipId} />

        <div className="flex flex-wrap gap-3">
          {status === 'pending' && (
            <SubmitButton
              variant="subtle"
              name="action"
              value="start_processing"
              disabled={!paymentApproved}
            >
              Begin processing
            </SubmitButton>
          )}
          {status === 'card_ready' && (
            <ConfirmSubmitButton
              name="action"
              value="activate"
              disabled={!cardReady}
              confirmMessage="Activate this membership? The member's card becomes fully valid."
            >
              Activate membership
            </ConfirmSubmitButton>
          )}
          {status === 'suspended' && (
            <SubmitButton variant="secondary" name="action" value="reinstate">
              Reinstate membership
            </SubmitButton>
          )}
          {['processing', 'card_ready', 'active', 'suspended'].includes(status) && (
            <ConfirmSubmitButton
              variant="danger"
              name="action"
              value="suspend"
              confirmMessage="Suspend this membership? It will show as suspended on public verification."
            >
              Suspend
            </ConfirmSubmitButton>
          )}
          {['card_ready', 'active', 'suspended'].includes(status) && (
            <ConfirmSubmitButton
              variant="danger"
              name="action"
              value="revoke"
              confirmMessage="REVOKE this membership? This is permanent — it will verify as revoked and cannot be undone."
            >
              Revoke
            </ConfirmSubmitButton>
          )}
          {status === 'active' && (
            <SubmitButton variant="subtle" name="action" value="expire">
              Mark expired
            </SubmitButton>
          )}
        </div>

        {['processing', 'card_ready', 'active', 'suspended'].includes(status) &&
          status !== 'pending' && (
            <Field
              label="Reason (required for suspend / revoke / cancel)"
              htmlFor="reason"
              hint="Recorded in the audit log and shared with the member where relevant."
            >
              <Input id="reason" name="reason" maxLength={1000} />
            </Field>
          )}

        <FormStateMessage state={state} />
      </form>

      {status === 'pending' && !paymentApproved && (
        <Alert tone="warning">
          The linked order payment is not yet approved — processing cannot begin.
        </Alert>
      )}
      {status === 'card_ready' && !cardReady && (
        <Alert tone="info">
          Activation requires a card design marked ready by the design team.
        </Alert>
      )}
    </div>
  );
}
