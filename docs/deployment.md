# Deployment guide — Vercel + Supabase + GitHub Actions

This document is the single source for infrastructure setup. It contains **no
secrets** — only the names of values and where they come from.

## 1. GitHub repository secrets

Set under: **Repository → Settings → Secrets and variables → Actions →
Repository secrets**.

| Secret | Required by | Where to get it |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | `supabase-migrate` workflow | Supabase Dashboard → Account → Access Tokens → Generate ("CI migration") |
| `SUPABASE_PROJECT_REF` | `supabase-migrate` workflow | The project ref, e.g. `jcmjbtgawpujjtravopi` (the subdomain of your project URL) |
| `SUPABASE_DB_PASSWORD` | `supabase-migrate` workflow | The database password chosen when the project was created — a **real password**, not the `[YOUR-PASSWORD]` placeholder: Supabase Dashboard → Settings → Database → "Reset database password" if unknown |

How it works:

- **On every push/PR** (`ci.yml`): lint → typecheck → unit tests → production
  build. Merge only when green (enable branch protection, checklist step 3).
- **On merge to `main` touching `supabase/**`** (`supabase-migrate.yml`):
  pending migrations are applied to the production project by the Supabase
  CLI (each migration runs exactly once, tracked in `supabase_migrations`),
  then `seed.sql` is applied (it is idempotent). **No more copying SQL into
  the dashboard editor.**
- First-time setting this up? Apply the existing migrations ONCE from the
  SQL editor first (00001–00004 + seed), so the CLI history matches the
  project's current state: run `supabase migration list` locally against the
  project afterwards to confirm.

## 2. Vercel environment variables

Project → Settings → Environment Variables. Set **Production** and
**Preview** separately — they must reference **different Supabase projects**
(see §4).

| Variable | Scope | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | The **publishable** key (`sb_publishable_…`) — safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | Supabase Dashboard → Settings → API → **service role** (secret). Server-only: bypasses RLS; used only after explicit permission checks |
| `NEXT_PUBLIC_SITE_URL` | Production + Preview | `https://<your-domain>` / `https://<preview-host>` |
| `EMAIL_PROVIDER` | both (optional) | `resend` (omit/empty = email intentionally disabled) |
| `RESEND_API_KEY` | both (optional) | Resend dashboard → API Keys |
| `EMAIL_FROM` | both (optional) | e.g. `Vantera <members@your-domain>` (domain must be verified in Resend) |
| `CONTACT_INBOX` | both (optional) | Business inbox for contact-form messages |

Marked sensitive: everything except the two `NEXT_PUBLIC_*` values and
`NEXT_PUBLIC_SITE_URL`. Vercel keeps server env out of the browser bundle by
construction; never rename a server variable to a `NEXT_PUBLIC_*` name.

## 3. Branch protection & build gating

1. Repo → Settings → Branches → protect `main`. Require the
  **CI (build & test)** check to pass before merging.
2. Do not protect preview branches — CI runs on every push anyway.

## 4. Preview vs production (hard separation)

| Concern | Production | Preview / staging |
| --- | --- | --- |
| Supabase project | `<prod-ref>` | Create a second project (free tier is enough), apply the same migrations + seed |
| Members data | Real | **Test accounts only** — never copy real customer data, never pay real crypto/gift cards |
| Vercel env | production env group | dedicated env group pointing at the staging project |
| Payment review | Business staff | Developers/testers with throwaway admin roles |

The app has no cross-project configuration surface: pointing Vercel Preview
at the staging Supabase project IS the separation.

## 5. Storage persistence

Both buckets (`payment-evidence`, `membership-cards`) are standard Supabase
storage — persistent, replicated, private. Nothing is local/temporary.
Signed URLs expire after 120 s by design; the bucket objects themselves are
permanent. Retention policies (evidence 24 months, accounts 36 months) are
business-configurable settings documented in `docs/privacy.md`.

## 6. Backups

- Supabase Pro → enable **Point-in-Time Recovery**. Free tier → set up a
  scheduled `pg_dump` from GitHub Actions (weekly) or duplicate the database
  password-protected dump to encrypted storage monthly. Table-level recovery
  is enough: history/audit tables make reconstruction possible.
- Media: Supabase storage objects are included in project backups (Pro).
  On Free tier, periodically sync the two buckets to an encrypted archive.

## 7. Rate limiting — honest assessment

Implemented: in-memory fixed-window limits on auth attempts (5/min per IP),
payment submission (6/min per user), order creation (10/min per user),
evidence upload (10/hour per user), contact form (5/min per IP), evidence and
card downloads (60/resp. 30 per hour per user).

On Vercel (serverless, multiple regions) each instance keeps its OWN window
— the limits still suppress low-effort abuse but are not a global counter.
For launch traffic this is acceptable; to upgrade:

- Vercel KV / Upstash-backed counter behind the existing `checkRateLimit`
  interface (single-file change), or
- Supabase Edge Function middleware with Postgres-backed counters.

## 8. Database changes day-to-day

1. Write a new migration file `supabase/migrations/NNNNN_description.sql`.
2. Open a PR. CI builds and tests.
3. Merge → `supabase-migrate` applies it automatically.

Never edit already-applied migrations; always append new ones.

## 9. First-run staging checklist (condensed from `docs/launch-checklist.md`)

1. Create staging Supabase project; apply migrations 00001–00004 + `seed.sql`.
2. Vercel: import repo, set **Preview** env vars to the staging project.
3. Register one throwaway account on the staging site; run
   `npm run grant-admin -- test-admin@vantera.example` with staging creds.
4. Set `EMAIL_*` vars OR confirm notifications are in-app only (by design).
5. Walk the whole journey with 3 accounts (member/reviewer/designer).
6. Configure crypto settings through `/admin/settings` (dummy addresses in
   staging), leave gift cards disabled.
7. Run the RLS integration suite against the staging project's THROWAWAY
   users (`docs/setup.md` §8).
