# Privacy rules (as implemented in code)

1. **Verification pages expose minimum data.** `/verify/[id]`, powered by the
   `verify_card` RPC, returns only state + masked reference (+ optional tier /
   expiry). Names, emails, phones, addresses, DOB, user ids, storage paths, and
   payment data are outside the function's SELECT list — *structurally
   impossible to leak*, not merely hidden by templates.

2. **Gift-card secrets are never collected.** Submissions reject unknown fields
   server-side; the UI never asks for them; notes are scanned for card-like
   digit runs and refused. Screenshots are instruct-edited to crop secrets.
   Evidence is retained only for the configured period (default 24 months).

3. **DOB is policy-gated.** `profile.require_date_of_birth` (private setting)
   controls whether the field appears at all; when enabled a privacy notice is
   shown at the point of collection; minimum-age checks are server-enforced;
   members cannot quietly change DOB afterward regardless of policy.

4. **QR codes and verification URLs embed no personal data** — only the opaque
   128-bit identifier. Enumeration is defeated by the space size + generic
   errors for unknown identifiers (no valid/invalid oracle at the entry page).

5. **Emails carry no sensitive details.** Templates reference orders by masked
   reference and link into the portal; no amounts beyond the shown tier price,
   no payment addresses beyond the configured public receiving address; never
   any evidence content.

6. **Audit logs contain no payment payloads** — action, entity id, state
   transition, and a small metadata excerpt (reviewer id, reason*). *Reasons
   are required for the member-facing workflow; they are shown to the member as
   context for their decision.

7. **Storage is end-to-end private.** Buckets never public; files addressed by
   random server names (original names can themselves contain PII and are
   discarded); downloads are short-lived, per-request signed URLs that
   re-verify authorization each time.

8. **Third parties.** Auth/data stay in Supabase (region selectable); email only
   flows to Resend if configured; no analytics, trackers, or third-party fonts
   (fonts are system stacks to avoid font-cdn telemetry).

9. **Retention** (`privacy.retention` setting): inactive accounts 36 months,
   evidence 24 months by default — both visible on the public privacy page,
   configurable only via settings.manage.

10. **Deletion requests.** Contact the configured privacy address; hard-delete
    of an auth user cascades to owned rows; financial records follow the
    configured retention before purge.
