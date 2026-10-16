# Setup guide

## 1. Prerequisites

- Node.js ≥ 20
- A Supabase project (free tier works)
- Optional: Resend account for transactional email

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where it comes from | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (`anon public`) | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (`service_role`) | **server only** — never expose |
| `NEXT_PUBLIC_SITE_URL` | Your base URL, e.g. `https://vantera.example.com` | emails, redirects |
| `RESEND_API_KEY` | Resend dashboard | email sending |
| `EMAIL_FROM` | e.g. `Vantera <members@your-domain.com>` | email sender |

The service-role key must exist ONLY in server environments (`.env.local`, Vercel env).
Any file bundling into the browser (`NEXT_PUBLIC_*`) may hold only the anon key.

## 3. Database provisioning

1. Open Supabase → SQL Editor.
2. Run the migrations **in order**, each in full:
   1. `supabase/migrations/00001_schema.sql` — tables, functions, triggers.
   2. `supabase/migrations/00002_rls_and_storage.sql` — RLS policies + storage
      buckets/policies (creates the two private buckets automatically).
   3. `supabase/migrations/00003_verify_card_rpc.sql` — the public-safe
      `verify_card` function.
3. Run `supabase/seed.sql` — permission catalog, preset tiers, default
   settings. Replace the placeholder tier content with business-approved copy
   before launch (or edit live via `/admin/packages`).
4. (Local dev alternative: `supabase start` + `supabase db push`.)

## 4. Auth configuration (Supabase → Authentication)

- Email provider: **ON**, "Confirm email": ON.
- Additional redirect URLs: `<your-site>/auth/callback` (and
  `http://localhost:3000/auth/callback` for dev).
- Rate limits: keep defaults; the app adds its own per-user throttles.

## 5. Storage buckets

Two buckets — **both PRIVATE** (the app's enforcement layer):

| Bucket | Max file | Allowed types | Purpose |
| --- | --- | --- | --- |
| `payment-evidence` | 10 MB | PNG, JPEG, PDF | screenshots/receipts for payment review |
| `membership-cards` | 15 MB | PNG, JPEG | issued card artwork |

Migration `00002_rls_and_storage.sql` creates both buckets with "public" OFF;
if you are on an existing project double-check them under Storage. The app
uploads with the service role after three-layer validation and serves files
only via per-request signed URLs (`/api/evidence/[id]`,
`/api/cards/[membershipId]/download`, 120 s TTL).

## 6. First administrator

Register that person through the website (so they have a normal account), then:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-key> \
npm run grant-admin -- admin@your-domain.com
```

This grants a full-permission `super_admin` role **outside** the website — there is
no browser path to privilege. Further admins are granted from `/admin/roles`.

## 7. Email

Email is optional but recommended: payment decisions and card-ready notices.

- Install prelaunch: create a Resend API key, set `RESEND_API_KEY` + `EMAIL_FROM`,
  verify your sending domain in Resend.
- Without a key, emails are skipped deliberately (never faked); in-app
  notifications still reach members. Delivery attempts are logged.

## 8. Local checks

```bash
npm run typecheck   # strict TypeScript
npm run lint        # eslint + next rules
npm test            # vitest unit suites (71 tests)
npm run build       # production build
```

RLS integration tests (optional, disposable local project):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
USER_A_EMAIL=... USER_A_PASSWORD=... USER_B_EMAIL=... USER_B_PASSWORD=... \
npx vitest run tests/integration
```

## 9. Deploy (Vercel)

1. Push to GitHub, import into Vercel.
2. Set all env vars (service key as a **server-only** secret).
3. In Supabase Auth redirect URLs add `https://<your-domain>/auth/callback` and
   the two password-recovery paths are handled by `/auth/callback?type=recovery`.
4. `NEXT_PUBLIC_SITE_URL` must equal the public origin.
