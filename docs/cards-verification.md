# Card lifecycle & public verification

## Lifecycle

```
awaiting_upload ──► in_preparation ──► ready
      ▲                    │             │  (re-upload loops back to
      └────────────────────┴─────────────┘   in_preparation, re-confirm)
```

- `awaiting_upload` — the shell exists (created on payment approval) but no
  artwork has been uploaded yet.
- `in_preparation` — an artwork version exists; a person must explicitly mark
  it ready (this is the *review gate*).
- `ready` — the owner can download it; the public identifier verifies as valid.

Operations exposed in `/admin/card-designs` and the membership detail workbench
(upload new version, mark ready, revoke, view verification URL) are all audited
and permission-gated by `cards.manage`.

## Storage

- Bucket `membership-cards`, **private**.
- Object paths: `<membershipId>/v<version>-<random-16-hex>.<ext>` — no member
  names or emails anywhere in paths.
- Downloads aren't file listings; they are per-request signed URLs (120 s TTL)
  minted by `GET /api/cards/[membershipId]/download` after it verifies the
  caller owns the membership (`status=ready` required) or holds `cards.manage`.
  Admins may also pass `?version=<versionId>` to preview drafts.

## Public verification (`/verify/{32-hex}`)

The public identifier is `crypto.randomBytes(16).toString('hex')` generated at
card creation; it is the *only* lookup key usable anonymously.

`verify_card(public_identifier)` returns exactly:

| Field | Content |
| --- | --- |
| `state` | `valid` / `invalid` / `suspended` / `revoked` / `expired` |
| `membership_number` | masked reference (`****-****-1234`) |
| `tier_name` | shown only if verification display setting enables it |
| `expiry_date` | date only, same toggle |

Because the SQL function selects only these columns, the page cannot leak PII
*even if a developer edits the page component* — there is nothing to render.
`FORBIDDEN_VERIFICATION_KEYS` is unit-tested against the payload serializer.

Invalid scans don't reveal whether an identifier exists (generic "not
recognised"), preventing enumeration of valid IDs.

## QR/asset note

The QR code on a card contains *only* the verification URL (`/verify/{id}`) —
never member data. That's policy `docs/privacy.md` item 4.
