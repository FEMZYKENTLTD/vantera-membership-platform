# Admin guide

## Roles & permissions

| Preset | Permissions | Best for |
| --- | --- | --- |
| `super_admin` | all 13 | founders / trusted operators |
| `payments_admin` | orders.view, payments.\*, customers.view, audit.view | finance reviewers |
| `designer` | cards.manage, customers.view | card artwork team — **cannot approve payments** |
| `support` | customers.view, orders.view | read-only customer care |

Custom subsets are possible — e.g. grant `memberships.manage` alone for a
memberships operator. Benign anti-confusion rules: admins cannot modify their
own role; designers have no payments permissions even if preset presets change.

## Daily runs

**Review queue** (`/admin/payments`):

1. Filter to *in review*, open a submission.
2. Verify: asset + network + address match settings; amount ≥ snapshot; tx hash
   exists on-chain for the *declared* network (check the right explorer); the
   screenshot matches the tx.
3. Evidence: use the download links (signed, expiring). Never ask members to
   re-confirm by channel email.
4. Decide:
   - **Approve** → a membership + card shell are issued immediately and the
     member is notified.
   - **Reject** → a reason is required and recorded; member is notified with
     restart instructions.
   - **Request information** → precise reason required; member edits and
     resubmits; the submission returns to pending review.

**Card artwork**:

1. `/admin/card-designs` shows the “awaiting upload” queue.
2. Upload PNG/JPEG (≤ 15 MB): it lands as version N; preview opens via the
   download route (draft OK for staff).
3. **Mark ready** — this is the point of activation; proof-check the artwork
   first. The member is emailed + notified in-app.
4. Revocation (e.g. leaked artwork, counterfeit risk) sets the card to
   revoked *with a reason*; the verify page immediately shows *revoked*.

**Memberships** (`/admin/memberships/[id]`): suspend / reinstate / mark expired /
revoke. Suspension and revocation demand a reason; every transition is mirrored
to `membership_status_history` and `audit_logs`.

**Customers**: disable (sign-in still works but ordering stops) and restore;
DOB is only editable while the DOB policy allows it, and it is policy-locked in
place afterward.

**Packages**: edit copy/price/benefits/terms. Price changes never touch existing
orders (snapshot); they are audit-logged. **Publish only business-approved copy.**

**Settings**:

- Brand/contact → the public footer + contact page.
- `payments.crypto` → enable only after entering real receiving addresses.
- `payments.gift_card` → enable only after written approval of issuer terms.
- `business.verification` → working-day window + holidays.
- `verification.card_display` → the public verify-page toggles.
- DOB policy → enable only when the business has codified retention + purpose.

**Audit logs**: filter by action (e.g. `payment.approved`) and/or entity. Logs
cannot be edited or deleted through the app.

## Escalation signals (overview page)

The admin home shows stat cards + "setup gaps" (unconfigured payment methods,
holidays, mint first admin) and the latest audit rows so drift is visible at a
glance.
