import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

const STEPS = [
  { key: 'created', label: 'Order created' },
  { key: 'payment', label: 'Payment submitted' },
  { key: 'verified', label: 'Payment verified' },
  { key: 'prepared', label: 'Card prepared' },
  { key: 'complete', label: 'Membership issued' }
] as const;

function stageOf(status: OrderStatus): number {
  switch (status) {
    case 'awaiting_payment':
      return 0;
    case 'payment_submitted':
    case 'under_review':
    case 'additional_information_required':
      return 1;
    case 'payment_approved':
      return 2;
    case 'membership_processing':
      return 3;
    case 'card_ready':
      return 3;
    case 'completed':
      return 4;
    case 'payment_rejected':
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const stage = stageOf(status);

  if (status === 'payment_rejected') {
    return (
      <p className="text-sm text-danger/90">
        The submitted payment was not approved — see the reason below and submit again.
      </p>
    );
  }
  if (status === 'cancelled') {
    return <p className="text-sm text-ivory-100/50">This order has been cancelled.</p>;
  }

  return (
    <ol className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i < stage || (i === stage && status === 'completed');
        const current = i === stage;
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  'absolute left-[11px] top-6 h-full w-px',
                  i < stage ? 'bg-gold-500/50' : 'bg-border'
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'z-10 flex size-[23px] shrink-0 items-center justify-center rounded-full border text-[10px]',
                done
                  ? 'border-gold-500 bg-gold-500/20 text-gold-300'
                  : current
                    ? 'border-gold-500/60 bg-gold-500/10 text-gold-300'
                    : 'border-border bg-noir-800 text-ivory-100/30'
              )}
            >
              {done ? <CheckIcon className="size-3" /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={cn('text-sm', done || current ? 'text-ivory-100' : 'text-ivory-100/40')}>
                {step.label}
              </p>
              {current && status !== 'completed' && (
                <p className="mt-0.5 text-xs text-gold-300/80">Current stage</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
