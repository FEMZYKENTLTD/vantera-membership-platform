'use client';

import { useActionState } from 'react';
import {
  uploadCardDesignAction,
  markCardReadyAction,
  revokeCardAction
} from '@/lib/admin/cards-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { ConfirmSubmitButton, SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { FileIcon, UploadIcon, QrIcon } from '@/components/icons';
import { formatDateTime } from '@/lib/utils';
import type { CardStatus } from '@/types/database';

interface Version {
  id: string;
  version: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  replacedReason: string | null;
}

interface Props {
  membershipId: string;
  membershipNumber: string;
  tierName: string;
  memberName: string;
  card: {
    status: CardStatus;
    currentVersionId: string | null;
    readyAt: string | null;
    publicIdentifier: string;
    revokedAt: string | null;
    revocationReason: string | null;
    versions: Version[];
  } | null;
  verifyUrl: string | null;
}

/**
 * Designer workbench: upload the externally-prepared card artwork, confirm
 * member + tier, preview files, mark ready, replace incorrect uploads and
 * revoke. No payment powers here — this panel holds only cards.manage.
 */
export function CardDesignPanel({
  membershipId,
  membershipNumber,
  tierName,
  memberName,
  card,
  verifyUrl
}: Props) {
  const [uploadState, uploadAction] = useActionState(uploadCardDesignAction, {});
  const [readyState, readyAction] = useActionState(markCardReadyAction, {});
  const [revokeState, revokeAction] = useActionState(revokeCardAction, {});

  const currentVersion = card?.versions.find((v) => v.id === card.currentVersionId) ?? null;

  return (
    <Card className="border-gold-500/25">
      <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Card design</CardTitle>
          <CardDescription>
            Confirm the member and tier before release — uploads replace nothing
            silently, every file is versioned.
          </CardDescription>
        </div>
        {card && <StatusBadge status={card.status} />}
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Identity confirmation */}
        <div className="grid gap-4 rounded-md border border-border bg-noir-800 p-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-ivory-100/40">Member</p>
            <p className="mt-1 text-ivory-100/90">{memberName}</p>
          </div>
          <div>
            <p className="text-ivory-100/40">Tier</p>
            <p className="mt-1 text-ivory-100/90">{tierName}</p>
          </div>
          <div>
            <p className="text-ivory-100/40">Membership</p>
            <p className="mt-1 text-ivory-100/90">{membershipNumber}</p>
          </div>
        </div>

        {card?.status === 'revoked' && (
          <Alert tone="error" title="This card has been revoked">
            Reason: {card.revocationReason ?? '—'}. Upload new artwork to issue a
            replacement card, then mark it ready.
          </Alert>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload */}
          <div>
            <p className="label-dark">
              {card?.versions.length ? 'Upload a replacement design' : 'Upload the finished design'}
            </p>
            <form action={uploadAction} className="space-y-4">
              <input type="hidden" name="membershipId" value={membershipId} />
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gold-500/30 bg-gold-500/[0.04] px-4 py-10 text-center text-sm text-ivory-100/60 transition-colors hover:border-gold-500/50 hover:text-ivory-100">
                <UploadIcon className="size-6 text-gold-400" />
                PNG, JPEG or PDF — up to 15 MB
                <span className="text-xs text-ivory-100/35">
                  The final artwork prepared outside this platform
                </span>
                <input
                  type="file"
                  name="file"
                  accept="image/png,image/jpeg,application/pdf"
                  className="sr-only"
                  required
                />
              </label>
              {card?.versions.length ? (
                <Field
                  label="Why is this being replaced? (recorded with the version)"
                  htmlFor="replaceReason"
                >
                  <Input id="replaceReason" name="replaceReason" maxLength={500} />
                </Field>
              ) : null}
              <SubmitButton variant="secondary" pendingLabel="Uploading…">
                Upload design
              </SubmitButton>
              <FormStateMessage state={uploadState} />
            </form>
          </div>

          {/* Current + actions */}
          <div className="space-y-5">
            <p className="label-dark">Current design</p>
            {currentVersion ? (
              <div className="rounded-md border border-border bg-noir-800 p-5">
                <div className="flex items-center gap-3 text-sm">
                  <FileIcon className="size-5 text-gold-400" />
                  <div className="min-w-0">
                    <p className="truncate text-ivory-100/90">
                      v{currentVersion.version} — {currentVersion.fileName}
                    </p>
                    <p className="text-xs text-ivory-100/40">
                      {Math.round(currentVersion.sizeBytes / 1024)} KB ·{' '}
                      {formatDateTime(currentVersion.createdAt)}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/cards/${membershipId}/download?version=${currentVersion.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-gold-300 underline-offset-2 hover:underline"
                >
                  Preview current file ↗
                </a>

                {card?.status === 'in_preparation' && (
                  <form action={readyAction} className="mt-5 space-y-3">
                    <input type="hidden" name="membershipId" value={membershipId} />
                    <ConfirmSubmitButton
                      confirmMessage={`Mark this card ready for ${memberName} (${tierName})? The member will be notified and can download it.`}
                    >
                      Mark ready for the member
                    </ConfirmSubmitButton>
                    <FormStateMessage state={readyState} />
                  </form>
                )}

                {card?.status === 'ready' && (
                  <p className="mt-4 text-xs text-success">
                    Ready since {formatDateTime(card.readyAt)} — the member can download
                    this file privately.
                  </p>
                )}

                {['in_preparation', 'ready'].includes(card?.status ?? '') && (
                  <form action={revokeAction} className="mt-5 space-y-3 border-t border-border/60 pt-5">
                    <input type="hidden" name="membershipId" value={membershipId} />
                    <Field label="Reason for revocation (required)" htmlFor="reason">
                      <Input id="reason" name="reason" maxLength={500} required />
                    </Field>
                    <ConfirmSubmitButton
                      variant="danger"
                      size="sm"
                      confirmMessage="Revoke this card? It will immediately verify as revoked."
                    >
                      Revoke card
                    </ConfirmSubmitButton>
                    <FormStateMessage state={revokeState} />
                  </form>
                )}
              </div>
            ) : (
              <p className="text-sm text-ivory-100/40">
                No artwork uploaded yet for this membership.
              </p>
            )}

            {verifyUrl && (
              <div className="rounded-md border border-border bg-noir-800 p-4">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold-400">
                  <QrIcon className="size-4" /> Verification URL for the artwork
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="break-all text-xs text-ivory-100/60">{verifyUrl}</code>
                  <CopyButton value={verifyUrl} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ivory-100/35">
                  Embed this URL (or a QR code resolving to it) in the design.
                  It reveals only validity — never member identity.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Version history */}
        {card && card.versions.length > 0 && (
          <div>
            <p className="label-dark">Version history</p>
            <ul className="space-y-2">
              {card.versions.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-4 py-3 text-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gold-300">v{v.version}</span>
                    <span className="truncate text-ivory-100/75">{v.fileName}</span>
                    {v.id === card.currentVersionId && (
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#8FBC9C]">
                        current
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-ivory-100/40">
                    {v.replacedReason && <span className="italic">“{v.replacedReason}”</span>}
                    {formatDateTime(v.createdAt)}
                    <a
                      href={`/api/cards/${membershipId}/download?version=${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold-300 underline-offset-2 hover:underline"
                    >
                      Open
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
