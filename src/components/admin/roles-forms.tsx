'use client';

import { useActionState, useState } from 'react';
import {
  grantRoleAction,
  setRolePermissionsAction,
  setRoleActiveAction
} from '@/lib/admin/roles-actions';
import { SubmitButton, ConfirmSubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ROLE_PRESETS } from '@/lib/permissions/permissions';
import { cn, formatDate } from '@/lib/utils';

interface RoleRow {
  id: string;
  user_id: string;
  role_key: string;
  is_active: boolean;
  created_at: string;
  email: string;
  permissions: string[];
}

export function RolesManager({
  roles,
  catalog,
  currentUserId
}: {
  roles: RoleRow[];
  catalog: { key: string; description: string }[];
  currentUserId: string;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <GrantRoleForm catalog={catalog} />
      <div className="space-y-4">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} catalog={catalog} isSelf={role.user_id === currentUserId} />
        ))}
        {roles.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-ivory-100/40">
            No administrator roles granted yet.
          </p>
        )}
      </div>
    </div>
  );
}

function GrantRoleForm({ catalog }: { catalog: { key: string; description: string }[] }) {
  const [state, formAction] = useActionState(grantRoleAction, {});
  const [preset, setPreset] = useState('payments_admin');
  const [selected, setSelected] = useState<string[]>(ROLE_PRESETS[preset]?.permissions ?? []);

  return (
    <form action={formAction} className="h-fit space-y-5 rounded-lg border border-gold-500/25 bg-noir-850 p-6">
      <p className="font-display text-lg">Grant a role</p>
      <Field label="Administrator email" htmlFor="email" required>
        <Input id="email" name="email" type="email" required placeholder="their Vantera account email" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Role" htmlFor="roleKey" required hint="A preset, or a custom lowercase key.">
          <Select
            id="rolePreset"
            value={preset}
            onChange={(e) => {
              const p = e.target.value;
              setPreset(p);
              setSelected(ROLE_PRESETS[p]?.permissions ?? []);
            }}
          >
            {Object.keys(ROLE_PRESETS).map((k) => (
              <option key={k} value={k}>
                {ROLE_PRESETS[k].label}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </Select>
        </Field>
        <Field label="Role key" htmlFor="roleKey">
          <Input
            id="roleKey"
            name="roleKey"
            value={preset === 'custom' ? undefined : preset}
            defaultValue={preset}
            key={preset}
            pattern="[a-z][a-z0-9_]{1,40}"
            required
          />
        </Field>
      </div>

      <fieldset>
        <legend className="label-dark">Permissions</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.map((p) => (
            <label
              key={p.key}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs transition-colors',
                selected.includes(p.key)
                  ? 'border-gold-500/50 bg-gold-500/[0.07]'
                  : 'border-border hover:border-gold-500/30'
              )}
            >
              <input
                type="checkbox"
                name="permissions"
                value={p.key}
                checked={selected.includes(p.key)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked ? [...s, p.key] : s.filter((k) => k !== p.key)
                  )
                }
                className="mt-0.5 accent-[#C6A468]"
              />
              <span>
                <code className="text-gold-300/90">{p.key}</code>
                <span className="mt-0.5 block text-ivory-100/45">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Granting…">Grant role</SubmitButton>
      <FormStateMessage state={state} />
      <p className="text-[11px] leading-relaxed text-ivory-100/35">
        Separation of duties: you cannot grant or modify roles on your own
        account. Consider giving designers ONLY cards.manage — never
        payments.approve.
      </p>
    </form>
  );
}

function RoleCard({
  role,
  catalog,
  isSelf
}: {
  role: RoleRow;
  catalog: { key: string; description: string }[];
  isSelf: boolean;
}) {
  const [permState, permAction] = useActionState(setRolePermissionsAction, {});
  const [activeState, activeAction] = useActionState(setRoleActiveAction, {});
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>(role.permissions);

  return (
    <div className={cn('rounded-lg border bg-noir-850 p-5', role.is_active ? 'border-border' : 'border-danger/30 opacity-70')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ivory-100">
            <code className="text-gold-300">{role.role_key}</code>
            <span className="text-ivory-100/40"> · {role.email}</span>
          </p>
          <p className="mt-1 text-xs text-ivory-100/35">
            granted {formatDate(role.created_at)}
            {!role.is_active && ' · inactive'}
            {isSelf && ' · (you)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={role.is_active ? 'green' : 'neutral'}>
            {role.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {!isSelf && (
            <form action={activeAction}>
              <input type="hidden" name="roleId" value={role.id} />
              <input type="hidden" name="isActive" value={String(!role.is_active)} />
              <ConfirmSubmitButton
                variant="ghost"
                size="sm"
                confirmMessage={
                  role.is_active
                    ? 'Deactivate this role? The account immediately loses these permissions.'
                    : 'Reactivate this role?'
                }
              >
                {role.is_active ? 'Deactivate' : 'Reactivate'}
              </ConfirmSubmitButton>
            </form>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
            disabled={isSelf}
          >
            {expanded ? 'Close' : 'Permissions'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {role.permissions.map((p) => (
          <Badge key={p} tone="gold" className="normal-case">
            {p}
          </Badge>
        ))}
        {role.permissions.length === 0 && (
          <span className="text-xs text-ivory-100/35">No permissions</span>
        )}
      </div>

      {expanded && !isSelf && (
        <form action={permAction} className="mt-5 space-y-4 border-t border-border/60 pt-5">
          <input type="hidden" name="roleId" value={role.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-center gap-2.5 text-xs">
                <input
                  type="checkbox"
                  name="permissions"
                  value={p.key}
                  checked={selected.includes(p.key)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, p.key] : s.filter((k) => k !== p.key)
                    )
                  }
                  className="accent-[#C6A468]"
                />
                <code className="text-ivory-100/70">{p.key}</code>
              </label>
            ))}
          </div>
          <ConfirmSubmitButton
            variant="secondary"
            size="sm"
            confirmMessage="Replace this role's permissions with your selection?"
          >
            Save permissions
          </ConfirmSubmitButton>
          <FormStateMessage state={permState} />
        </form>
      )}
      <FormStateMessage state={activeState} />
    </div>
  );
}
