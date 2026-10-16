'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (
        <>
          <Spinner /> {pendingLabel ?? 'Working…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/**
 * Submit button that asks for explicit confirmation first — used for
 * irreversible administrative actions (approve / reject / suspend / revoke).
 */
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  ...props
}: ButtonProps & { confirmMessage: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
      {...props}
    >
      {pending ? <Spinner /> : children}
    </Button>
  );
}

export function FormStateMessage({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
  className
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <label htmlFor={htmlFor} className="label-dark">
        {label}
        {required && <span className="text-gold-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ivory-100/40 leading-relaxed">{hint}</p>}
    </div>
  );
}
