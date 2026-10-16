# Launch checklist

Nothing ships unconfigured, and nothing fake ships at all.

## Business

- [ ] Approve final copy: home, about, tiers (descriptions, benefits, terms),
      FAQ, legal pages. No invented benefits, partnerships or returns claims.
- [ ] Confirm each package's price, currency, and duration (start DB-driven;
      override only via `/admin/packages`).
- [ ] Appoint the initial super admin (operator + email account registered).
- [ ] Appoint payments reviewer(s) and card designer(s); grant presets only —
      designers **must not** hold payments permissions.
- [ ] Decide: enable crypto? Enable gift cards? **Gift cards require written
      confirmation that issuer terms permit the practice** — otherwise leave
      `payments.gift_card.enabled = false` (it ships disabled).
- [ ] Load public holidays for the business-day calculator
      (`business.verification.holidays`).
- [ ] If DOB collection is required, record the privacy purpose + retention
      wording *before* enabling the policy in settings.
- [ ] Confirm the public contact method (email/WhatsApp) actually reaches a
      human. Empty contact methods hide the contact CTA instead of lying.
- [ ] Brand assets: replace hero/about imagery if preferred; supply fonts
      if a licensed brand family replaces the system fallbacks.

## Engineering

- [ ] Apply both migrations to the production project.
- [ ] Create both private storage buckets with correct caps/types.
- [ ] Set ALL env vars on Vercel (service key = server-only secret).
- [ ] Auth redirects: add `https://<domain>/auth/callback`; email templates
      point at the callback.
- [ ] Run `npm run grant-admin` with the production credentials.
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` — green.
- [ ] Walk the full journey on staging with two throwaway accounts
      (member + reviewer): order → crypto submission → evidence → request
      info → resubmit → approve → card upload → mark ready → member download →
      public verify shows **valid** → reject path with reason → audit rows exist.
- [ ] RLS integration suite passes against a disposable project.
- [ ] Confirm `EMAIL_FROM` domain verified (else disable email intentionally
      rather than relying on sandbox sends).
- [ ] Confirm error pages (`not-found`, error boundary) render on-brand.
- [ ] Enable Vercel deployment protection if the launch should be private-beta.

## Post-launch watch (first week)

- [ ] `/admin` overview: no unexpected setup-gap alerts.
- [ ] Audit log drill-ins for each approved payment.
- [ ] Try the public verify flow for every issued card.
- [ ] Monitor sign-in/notice emails: delivered or intentionally skipped?
