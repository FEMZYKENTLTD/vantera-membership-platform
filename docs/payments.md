# Payment review workflow

## Philosophy

Vantera payments are **evidence-based, human-verified**: the platform never trusts
a blockchain explorer or gift-card API implicitly — a reviewer confirms against the
official destination records before approval. This eliminates:

- fake-auto-approval risk (double-spends, mismatched amounts, wrong networks),
- impersonation risk for gift cards,
- and it makes the audit trail meaningful to an external accountant.

Honest trade-off (stated to customers at checkout): **verification takes 1–3
working days; weekends never count.**

## The flow

```
member picks a tier ──► create_order() ──► order(status=awaiting_payment,
│                                            price snapshot locked)
│
├─► crypto submission (asset, network, amount, tx hash)  ─┐
├─► gift-card submission (issuer, denomination, receipt) ─┤ always Zod-strict,
│                                                          ► payment(status=pending_review)
└─► evidence upload (screenshot/PDF, magic-bytes validated)│
                                                           ▼
reviewer at /admin/payments ──► mark_under_review ──► approve ──► issue membership
                          │                            │                (seat/number, card shell)
                          │                            └─► reject (reason required)
                          └─► request_info (reason required) ──► member edits the SAME
                                                                        submission in place
                                                                        (back to pending_review)
```

## Server guarantees

| Guarantee | Mechanism |
| --- | --- |
| Order price can never be tampered from the client | `create_order` snapshots `membership_tiers.price/currency` inside a definer function; client sends only `tierId` |
| No self-approval | review actions check `payment.user_id != reviewer`; a member clicking approve with devtools hits a 403 + audit |
| No double-processing | `assertReviewAction` + atomic conditional UPDATE (`WHERE status IN (...)`) — a second tab sees "already reviewed" |
| Rejection/request-info requires a reason | schema + `assertReviewAction` + DB-side NOT NULL on history reason |
| Reviewer history & state changes append-only | `payment_review_history`, `audit_logs` RLS: no UPDATE/DELETE |
| Idempotent creation | `create_order()` returns the SAME existing open order for duplicate submissions (per-user advisory lock); a partial unique index `one_open_payment_per_order` guarantees at most one open payment per order — corrections replace that row in place via guarded resubmission |
| Money as exact values | integer *minor units* (cents) via `toMinorUnits` — tests cover the classic `0.10 + 0.20` float trap |
| Working-day window | `verificationEstimate` walks a business-day calendar skipping weekends + admin-configured holidays |

## Who can do what

| Action | Member | support | designer | payments_admin | super_admin |
| --- | --- | --- | --- | --- | --- |
| Submit payment + evidence | ✔ own | ✖ | ✖ | ✖ | ✖ |
| View review queue | ✖ | view only | ✖ | ✔ | ✔ |
| Approve / reject | ✖ | ✖ | ✖ | ✔ | ✔ |
| Request information | ✖ | ✖ | ✖ | ✔ | ✔ |
| Issue membership (implicit on approval) | ✖ | ✖ | ✖ | ✔ (via approve) | ✔ |
| Override prices or bypass states | ✖ | ✖ | ✖ | ✖ | ✖ (only by editing tiers, logged) |

## Gift cards — the privacy rules implemented in code

1. Submissions are `.strict()` schemas — unknown keys (e.g. `pin`, `cardNumber`,
   `redemptionCode`) throw.
2. The notes field is screened for card-like digit runs (`looksLikeGiftCardSecret`)
   and refused with an in-app warning; the UI + instructions tell members to crop
   secrets out of screenshots.
3. Reviewers see a policy banner: check issuer terms, verify against official
   portals, and remember evidence is retained for the configured window only.
4. Never enable `payments.gift_card` in settings until the business has
   approved it in writing (see launch checklist).

## The verification window

`business.verification.workingDays` (default 3) is added to the submission date
using a walk-day algorithm: Sat/Sun are skipped; public holidays from
`business.verification.holidays` (ISO dates) are skipped. The portal shows the
estimate + an "overdue" flag past the deadline. Reviews themselves can be done
any day — the window governs the published commitment, not when staff can work.
