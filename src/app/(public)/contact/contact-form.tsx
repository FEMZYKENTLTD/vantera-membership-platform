'use client';

import { useActionState } from 'react';
import { submitContactForm } from '@/lib/public-actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input, Textarea } from '@/components/ui/input';

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, {});
  return (
    <form action={formAction} className="space-y-5">
      <Field label="Your name" htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required maxLength={200} />
      </Field>
      <Field label="Email address" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </Field>
      <Field label="Message" htmlFor="message" required>
        <Textarea id="message" name="message" required maxLength={5000} rows={6} />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
      <FormStateMessage state={state} />
      <p className="text-xs leading-relaxed text-ivory-100/35">
        We use your details only to respond to your enquiry. See our{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-ivory-100/60">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
