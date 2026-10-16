'use client';

import { useActionState, useState } from 'react';
import {
  upsertPackageAction,
  togglePackagePublishedAction
} from '@/lib/admin/packages-actions';
import { SubmitButton, ConfirmSubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { MembershipTierRow } from '@/types/database';

export function PackageEditor({ tiers }: { tiers: MembershipTierRow[] }) {
  const [editing, setEditing] = useState<MembershipTierRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [state, formAction] = useActionState(upsertPackageAction, {});

  const current = editing;
  const showForm = creating || current !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* List */}
      <div className="space-y-4">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              'rounded-lg border p-5 transition-colors',
              current?.id === tier.id
                ? 'border-gold-500/50 bg-gold-500/[0.05]'
                : 'border-border bg-noir-850'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl">
                  {tier.name}{' '}
                  <span className="font-sans text-sm text-ivory-100/40">
                    {formatMoney(tier.price, tier.currency)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ivory-100/40">
                  /membership/{tier.slug} · order {tier.display_order}
                  {tier.duration_months ? ` · ${tier.duration_months} months` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={tier.is_published ? 'active' : 'pending'} />
                <PublishToggle id={tier.id} isPublished={tier.is_published} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditing(tier);
                    setCreating(false);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>
        ))}

        <Button
          variant="subtle"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          + New package
        </Button>
      </div>

      {/* Editor */}
      <div>
        {showForm ? (
          <form action={formAction} className="space-y-5 rounded-lg border border-gold-500/25 bg-noir-850 p-6">
            <p className="font-display text-lg">
              {current ? `Edit ${current.name}` : 'New package'}
            </p>
            <input type="hidden" name="id" value={current?.id ?? ''} />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required>
                <Input id="name" name="name" defaultValue={current?.name ?? ''} required maxLength={120} />
              </Field>
              <Field
                label="URL slug"
                htmlFor="slug"
                required
                hint="Lowercase; changing it changes the public URL."
              >
                <Input id="slug" name="slug" defaultValue={current?.slug ?? ''} required pattern="[a-z0-9-]+" />
              </Field>
            </div>

            <Field label="Description" htmlFor="description">
              <Textarea id="description" name="description" rows={3} defaultValue={current?.description ?? ''} maxLength={2000} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Price" htmlFor="price" required hint="Existing orders keep their locked price.">
                <Input
                  id="price"
                  name="price"
                  inputMode="decimal"
                  defaultValue={current ? String(current.price) : ''}
                  required
                />
              </Field>
              <Field label="Currency" htmlFor="currency" required>
                <Input id="currency" name="currency" defaultValue={current?.currency ?? 'USD'} maxLength={3} required />
              </Field>
              <Field label="Duration (months)" htmlFor="durationMonths" hint="Blank = no expiry">
                <Input
                  id="durationMonths"
                  name="durationMonths"
                  type="number"
                  min={1}
                  defaultValue={current?.duration_months ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Display order" htmlFor="displayOrder" required>
                <Input
                  id="displayOrder"
                  name="displayOrder"
                  type="number"
                  min={0}
                  defaultValue={current?.display_order ?? 0}
                  required
                />
              </Field>
              <Field label="Published" htmlFor="isPublished">
                <Select
                  id="isPublished"
                  name="isPublished"
                  defaultValue={current?.is_published ? 'true' : 'false'}
                >
                  <option value="true">Published</option>
                  <option value="false">Unpublished</option>
                </Select>
              </Field>
            </div>

            <Field
              label="Approved benefits (one per line)"
              htmlFor="benefits"
              hint="Only business-approved benefits. Nothing here may imply financial returns."
            >
              <Textarea
                id="benefits"
                name="benefits"
                rows={6}
                defaultValue={
                  Array.isArray(current?.benefits)
                    ? (current.benefits as string[]).join('\n')
                    : ''
                }
              />
            </Field>

            <Field label="Membership terms" htmlFor="terms">
              <Textarea id="terms" name="terms" rows={4} defaultValue={current?.terms ?? ''} maxLength={5000} />
            </Field>

            <div className="flex gap-3">
              <SubmitButton pendingLabel="Saving…">Save package</SubmitButton>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setCreating(false);
                }}
              >
                Cancel
              </Button>
            </div>
            <FormStateMessage state={state} />
          </form>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-ivory-100/40">
            Select a package to edit, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}

function PublishToggle({ id, isPublished }: { id: string; isPublished: boolean }) {
  const [, formAction] = useActionState(togglePackagePublishedAction, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton
        variant="ghost"
        size="sm"
        confirmMessage={
          isPublished
            ? 'Unpublish this package? It will disappear from the public site.'
            : 'Publish this package? It will appear on the public site immediately.'
        }
      >
        {isPublished ? 'Unpublish' : 'Publish'}
      </ConfirmSubmitButton>
    </form>
  );
}
