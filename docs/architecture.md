# Architecture

## Layout

Next.js App Router with three trust zones, all enforced **server-side**:

| Zone | Routes | Gate |
| --- | --- | --- |
| Public | `/`, `/about`, `/faq`, `/membership*`, `/contact`, `/verify*`, terms/privacy | none (public data only via RPC/`is_public` settings) |
| Member | `/portal/**` | `requireUser()` — Supabase Auth session |
| Admin | `/admin/**` | `requireAdmin(permission)` per page/action |
| API | `/api/cards/.../download`, `/api/evidence/[id]` | ownership/permission + rate limit, signed URLs |

Route groups: `(public)` and `(auth)` add layout chrome only — no security meaning.
Security lives in `src/lib/auth/session.ts` helpers, Server Actions, and Postgres RLS.

## Data model (`supabase/migrations/00001_schema.sql`)

16 tables:

| Table | Purpose | Key notes |
| --- | --- | --- |
| `profiles` | Member profile (name, contact, optional DOB policy) | created by trigger on auth signup; self R/W, admim manage |
| `membership_tiers` | The 4 packages (name/slug/price/currency/benefits/terms) | `is_published` gates public visibility |
| `orders` | Purchase orders with **price snapshot** (unit/total/currency locked at creation) | created only via `create_order()` RPC |
| `payment_submissions` | Crypto/gift-card payment declarations | status state machine; idempotency key; `verified_by` refers to review action vs creation |
| `payment_evidence` | Evidence file metadata (`payment-evidence` bucket paths) | secrets never stored (see below) |
| `payment_review_history` | Append-only reviewer history + reasons | admin/RLS locked |
| `memberships` | Awarded membership per approved order | lifecycle transitions; unique membership number |
| `membership_status_history` | Append-only membership lifecycle log | — |
| `membership_cards` | 1:1 per membership; status machine + **random 32-hex public identifier** | — |
| `membership_card_versions` | Each uploaded artwork revision, current pointer | `membership-cards` bucket |
| `notifications` | In-app notices (payment status, card ready…) | per-user RLS |
| `admin_roles` / `admin_role_permissions` | Server-managed RBAC | no self-grant |
| `admin_permissions` | Static permission catalog (13 keys) | seeded |
| `audit_logs` | Append-only security log | written server-side only; no app-level update/delete |
| `site_settings` | Keyed JSON config (brand/payments/verification/privacy) | `is_public` column gates anon read |

Functions (security-definer, owned fast paths):

- `create_order(p_tier_id)` — the ONLY way orders are created (member direct
  inserts are policy-denied). Under a per-user advisory lock it: enforces an
  active profile, reuses an existing awaiting-payment order for the same user
  + tier (true duplicate-submit idempotency), enforces the open-order cap,
  and writes the price snapshot from the tier row — no caller-influenced
  pricing at the database boundary.
- `verify_card(p_public_identifier)` — returns the **whitelisted** verify tuple.
- `has_permission(p_user_id, p_permission)` — RLS helper for admin policies.
- `register_membership_*` triggers — emit status history rows.

## Request flow

1. Middleware refreshes the Supabase session cookie (no localStorage tokens).
2. Pages are Server Components: data fetched with the session-bound client → RLS scoped to
   the caller; admin pages additionally call `requireAdmin(PERM)` which redirects on failure.
3. Mutations are Server Actions: zod-validate input → authorization check → service-role
   client only where elevation is explicitly required (review decisions, membership issuance,
   notifications, audit). All money + state transitions happen in these handlers only.
4. Storage is private; downloads signed for 120 s via API routes that re-check authorization.

## Project layout

```
src/
  app/
    (public)/   home, about, faq, membership list+detail, contact, privacy, terms
    (auth)/     login, register, forgot/reset password
    portal/     dashboard, profile, orders[+detail], payments, memberships[+detail],
                cards, notifications, security
    admin/      overview, customers[+detail], payments[+detail], orders[+detail],
                memberships[+detail], card-designs, packages, roles, audit-logs, settings
    verify/     entry + [publicIdentifier]
    api/        cards download, evidence download
    auth/       callback, signout route handlers
  components/   ui/, portal/, admin/ (all client files are thin form components)
  lib/
    auth/       session & permission guards
    supabase/   browser, server, middleware, admin (service) clients
    payments/   state machine, review logic, pricing (integer minor units)
    memberships/ transitions, status mapping
    storage/    upload validation (magic bytes, size, extenions)
    verify/     privacy-whitelisted payload builder
    business-days.ts  1–3 working day window (weekends/holidays excluded)
    validation/ all zod schemas (server-truth input validation)
    settings.ts site_settings loaders + defaults + fallbacks
supabase/
tests/
docs/
```

## Key dependency choices

- `@supabase/ssr` cookie sessions (current guidance; async `cookies()` in Next 15).
- `zod` for all input schemas (crypto submissions are `.strict()`).
- No client-side state library: server data + small `useActionState` forms.
- Node.js Server Actions (not edge) — Supabase client runs in the Node runtime.
