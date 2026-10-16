import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type {
  CardStatus,
  MembershipStatus,
  OrderStatus,
  PaymentStatus,
  ProfileStatus
} from '@/types/database';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase',
  {
    variants: {
      tone: {
        gold: 'border-gold-500/40 text-gold-300 bg-gold-500/10',
        green: 'border-success/40 text-[#8FBC9C] bg-success/10',
        red: 'border-danger/40 text-[#D09087] bg-danger/10',
        amber: 'border-warning/40 text-[#D4B078] bg-warning/10',
        blue: 'border-info/40 text-[#9DB2CC] bg-info/10',
        neutral: 'border-border text-ivory-100/60 bg-ivory-100/5'
      }
    },
    defaultVariants: { tone: 'neutral' }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Domain status badges — one canonical, customer-safe label per status.
// ---------------------------------------------------------------------------

type Tone = NonNullable<BadgeProps['tone']>;

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // orders
  awaiting_payment: { label: 'Awaiting payment', tone: 'amber' },
  payment_submitted: { label: 'Payment submitted', tone: 'blue' },
  under_review: { label: 'Under review', tone: 'blue' },
  payment_approved: { label: 'Payment approved', tone: 'green' },
  payment_rejected: { label: 'Payment not approved', tone: 'red' },
  additional_information_required: { label: 'More info needed', tone: 'amber' },
  membership_processing: { label: 'Preparing membership', tone: 'blue' },
  card_ready: { label: 'Card ready', tone: 'green' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  // payments
  submitted: { label: 'Submitted', tone: 'blue' },
  pending_review: { label: 'Awaiting review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Not approved', tone: 'red' },
  // memberships
  pending: { label: 'Pending', tone: 'amber' },
  processing: { label: 'Processing', tone: 'blue' },
  active: { label: 'Active', tone: 'green' },
  suspended: { label: 'Suspended', tone: 'red' },
  revoked: { label: 'Revoked', tone: 'red' },
  expired: { label: 'Expired', tone: 'neutral' },
  // cards
  awaiting_upload: { label: 'Awaiting design', tone: 'amber' },
  in_preparation: { label: 'In preparation', tone: 'blue' },
  ready: { label: 'Ready', tone: 'green' },
  // verification
  valid: { label: 'Valid', tone: 'green' },
  invalid: { label: 'Invalid', tone: 'red' }
};

export function StatusBadge({
  status,
  className
}: {
  status:
    | OrderStatus
    | PaymentStatus
    | MembershipStatus
    | CardStatus
    | ProfileStatus
    | 'valid'
    | 'invalid';
  className?: string;
}) {
  const entry = STATUS_MAP[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as Tone };
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}
