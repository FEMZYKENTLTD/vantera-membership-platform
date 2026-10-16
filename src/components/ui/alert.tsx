import { cn } from '@/lib/utils';
import { AlertIcon, CheckIcon, InfoIcon } from '@/components/icons';

const tones = {
  info: 'border-info/40 bg-info/10 text-[#B9C9E0]',
  success: 'border-success/40 bg-success/10 text-[#A8CCB3]',
  error: 'border-danger/50 bg-danger/10 text-[#E0A79E]',
  warning: 'border-warning/40 bg-warning/10 text-[#E3C893]'
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className
}: {
  tone?: keyof typeof tones;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === 'error' ? AlertIcon : tone === 'success' ? CheckIcon : InfoIcon;
  return (
    <div className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm', tones[tone], className)}>
      <Icon className="mt-0.5 size-4" />
      <div>
        {title && <p className="font-medium mb-0.5">{title}</p>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
