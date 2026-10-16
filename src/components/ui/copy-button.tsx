'use client';

import { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-ivory-100/50 hover:bg-ivory-100/10 hover:text-ivory-100',
        className
      )}
    >
      {copied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
    </button>
  );
}
