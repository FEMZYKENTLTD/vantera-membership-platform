# Vantera — Luxury Membership Platform

Vantera is a production-grade private membership platform: members apply for one of four
tiers, pay by manually-verified transfer (crypto or approved gift-card evidence), and
receive a personally designed, privately downloadable membership card carrying a
public-verifiable identifier.

**Stack:** Next.js 15 (App Router, React 19) · TypeScript (strict) · Tailwind CSS ·
Supabase (Postgres + Auth + private Storage + RLS) · zod · Vitest.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure environment (never commit real values)
cp .env.example .env.local   # fill in your Supabase project credentials

# 3. Create the database schema
#    Run the three migrations in order (00001_schema.sql,
#    00002_rls_and_storage.sql, 00003_verify_card_rpc.sql) then
#    supabase/seed.sql, in the Supabase SQL editor
#    (or `supabase db push` + `supabase db seed` with the CLI).

# 4. Run
npm run dev                  # local

# 5. Prove integrity
npm run typecheck && npm run lint && npm test && npm run build
```

First administrator (after registering that account on the site):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run grant-admin -- admin@your-domain.com
```

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Data model, request flow, project layout |
| [docs/setup.md](docs/setup.md) | Full environment/provisioning guide, including email |
| [docs/deployment.md](docs/deployment.md) | GitHub secrets, Vercel env, CI/CD, staging separation, backups |
| [docs/security.md](docs/security.md) | RLS matrix, threat model, server-side guarantees |
| [docs/payments.md](docs/payments.md) | The manual payment review workflow, state machines |
| [docs/cards-verification.md](docs/cards-verification.md) | Card lifecycle, downloads, verification |
| [docs/admin-guide.md](docs/admin-guide.md) | Admin dashboard operations, runs of the house |
| [docs/privacy.md](docs/privacy.md) | Privacy rules: what is collected, stored, shown |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Pre-launch business + engineering checklist |
| [docs/AUDIT-2026-10-16.md](docs/AUDIT-2026-10-16.md) | Independent audit findings + fixes (appendix) |

## Structure

```
src/
  app/                 App Router routes: (public), (auth), portal/, admin/, api/, verify/
  components/          ui primitives + portal/* + admin/*
  lib/                 auth, supabase, payments, memberships, storage, settings, verify…
supabase/migrations/   00001_schema.sql (16 tables, functions, triggers),
                       00002_rls_and_storage.sql (RLS + storage buckets/policies),
                       00003_verify_card_rpc.sql (public-safe verify function)
supabase/seed.sql      permission catalog, preset tiers, default settings
tests/                 vitest unit suites + env-gated RLS integration suite
docs/                  the documents above
```

## Non-negotiables

- Every price decision is taken server-side from the database tier row; clients
  never send amounts for orders.
- Payments are **never auto-approved**. A person reviews each submission
  (1–3 working days, weekends excluded), with an audit trail.
- Gift-card submissions **never** collect PINs, redemption or claim codes.
- Card files are private storage objects, visited through short-lived signed URLs.
- The public verify page shows only: verifier state, masked membership reference,
  and (optionally) tier name/expiry — never personal data.
