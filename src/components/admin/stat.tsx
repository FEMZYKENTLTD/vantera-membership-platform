import Link from 'next/link';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  href,
  tone = 'default'
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: 'default' | 'gold' | 'alert';
}) {
  const inner = (
    <div
      className={cn(
        'surface-raised p-6 transition-colors',
        href && 'hover:border-gold-500/30',
        tone === 'gold' && 'border-gold-500/25',
        tone === 'alert' && 'border-warning/40'
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-ivory-100/40">{label}</p>
      <p
        className={cn(
          'mt-2 font-display text-4xl',
          tone === 'gold' ? 'text-gold-300' : tone === 'alert' ? 'text-warning' : 'text-ivory-100'
        )}
      >
        {value}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function PageHeader({
  eyebrow = 'Administration',
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-3 mt-2">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-ivory-100/50">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
