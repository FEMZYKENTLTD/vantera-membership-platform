# Security model

## Principles

1. **Server truth.** Prices, statuses, permissions and lifecycle transitions are
   decided server-side (Server Actions + Postgres functions). The client never
   sends an amount when creating an order; it never decides a state transition.
2. **Least privilege.** Members see only their own data; admins see only what
   their permissions allow; the service key never leaves the server.
3. **Privacy by construction.** Public surfaces are built from whitelisted
   fields — verify pages literally cannot carry a name/email because the SQL
   function doesn't select them.
4. **Non-repudiation.** Every administrative decision is recorded in
   append-only history tables and `audit_logs` (no app-level UPDATE/DELETE).

## Row Level Security matrix (all tables RLS-enabled)

Owner = `auth.uid()`; perm = `has_permission()` definer helper.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles | owner, customers.view | system (trigger) | owner + customers.manage | — |
| membership_tiers | published: everyone; all: packages.manage | packages.manage | packages.manage | — |
| orders | owner, orders.view | system RPC only (definer) | system RPC (cancellation) | — |
| payment_submissions | owner, payments.review | owner (validated server-side) | reviewers via service | — |
| payment_evidence | owner, payments.review | owner (while evidence accepts) | — | reviewers/service |
| payment_review_history | payments.review | service only | — | — |
| memberships | owner, customers.view/memberships.manage | service only | memberships.manage | — |
| membership_status_history | owner, reviewers | service only | — | — |
| membership_cards | owner, cards.manage | service only | cards.manage/service | — |
| membership_card_versions | owner, cards.manage | cards.manage | cards.manage | — |
| notifications | owner | service | owner (mark read) | — |
| admin_roles / _permissions | roles.manage | roles.manage | roles.manage | roles.manage |
| admin_permissions | authenticated | — | — | — |
| audit_logs | audit.view | service | — | — |
| site_settings | `is_public` rows: everyone; all: settings.manage | settings.manage | settings.manage | — |

No customer-side policy grants INSERT/UPDATE/DELETE to another user's row, and
anonymous sessions can reach only: published tiers, public settings, and the
`verify_card` RPC.

## Input & upload validation

- All Server Actions validate with zod first; crypto/gift-card payloads are
  `.strict()` (extra fields rejected) — **structure-level prohibition of PINs,
  card numbers, redemption/claim codes**. `looksLikeGiftCardSecret` additionally
  screens free-text notes before persisting.
- Uploads pass three layers: extension allowlist → declared MIME check →
  **magic-byte sniffing**; size caps 10 MB (evidence) / 15 MB (cards); stored
  under server-generated random names; original names (potential PII like
  "sarah-jones-id.pdf") never reach object paths.
- Limits: per-scope buckets via `checkRateLimit` (auth 5/min per IP, order
  creation 10/min, payment submit/resubmit 6/min, evidence upload 10/h, contact
  5/min, evidence downloads 60/h, card downloads 30/h). IP is read from
  `x-forwarded-for` — correct on Vercel; on a naive self-host a spoofed header
  would defeat the IP key (documented trade-off). Swap the in-memory store for
  Upstash/Vercel KV for strict multi-instance limits.

## State machines (enforced server-side twice — TS + SQL CHECK)

- Payment: `awaiting_evidence → pending_review → under_review → approved|rejected`,
  with `additional_information_required` loops. `approved`/`rejected` are
  terminal, so double-clicks/idempotent replays are no-ops.
- Membership: `pending → processing → card_ready → active`, plus
  `suspended|revoked|expired|cancelled` as appropriate.
- Cards: `awaiting_upload → in_preparation → ready` (+ re-preparation loop).

Secrets of **state**: a membership never skips `processing`, a card is never
downloadable before `ready`, and rejection requires a reason (schema + logic).

## Sessions & authn

- Supabase Auth with `@supabase/ssr` cookies — httpOnly, no localStorage tokens.
- Password reset uses `/auth/callback?type=recovery` → `exchangeCodeForSession`
  → `/reset-password`. New passwords are validated for length.
- `getSessionUser()` re-validates the user against Supabase (it does not trust
  cookies blindly).
- Admin pages run `requireAdmin(permission)`; client components merely mirror
  the decision for UX. **Permission strings in client code gate nothing real.**

## Admin bootstrap

No public self-elevation path exists. The first admin is granted by the
`scripts/grant-admin.mjs` operator script; later grants require an existing
`roles.manage` permission, and admins cannot edit their own role (enforced at
the action layer).

## Known acceptable risks

- In-memory rate limiting resets on cold starts on serverless — deliberate,
  documented in `src/lib/rate-limit.ts`.
- Manual review is by design; no automated payment verification is shipped in
  release 1 and none is simulated.
