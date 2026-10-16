-- =============================================================================
-- Vantera — Seed data (safe for all environments; contains NO real customers)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Admin permission catalog
-- ---------------------------------------------------------------------------
insert into public.admin_permissions (key, description) values
  ('orders.view',        'View orders and order details'),
  ('orders.manage',      'Update order status and cancel orders'),
  ('payments.review',    'Access the payment review queue and evidence'),
  ('payments.approve',   'Approve a submitted payment'),
  ('payments.reject',    'Reject a payment or request more information'),
  ('customers.view',     'View customer records'),
  ('customers.manage',   'Update customer records and suspend accounts'),
  ('memberships.manage', 'Manage memberships: processing, suspension, revocation'),
  ('cards.manage',       'Upload and manage membership card designs'),
  ('packages.manage',    'Manage membership packages and prices'),
  ('roles.manage',       'Grant and revoke administrator roles'),
  ('settings.manage',    'Edit site and payment configuration'),
  ('audit.view',         'View audit logs')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- The four initial membership packages (USD). Benefits/terms are deliberately
-- minimal — the business must approve final content via /admin/packages.
-- ---------------------------------------------------------------------------
insert into public.membership_tiers
  (slug, name, description, price, currency, display_order, is_published,
   duration_months, benefits, terms)
values
  (
    'signature', 'Signature',
    'The entry to the Vantera circle. A personalised membership card issued to approved members.',
    1000.00, 'USD', 1, true, 12,
    '["Personalised Vantera membership card", "Dedicated member support", "Access to member communications"]',
    'Membership is issued only after payment verification (1–3 working days). Benefits are configured by Vantera and published on this page; no other benefit is implied.'
  ),
  (
    'prestige', 'Prestige',
    'An elevated tier for members who expect priority attention.',
    3000.00, 'USD', 2, true, 12,
    '["Everything in Signature", "Priority member support", "Priority card preparation"]',
    'Membership is issued only after payment verification (1–3 working days). Benefits are configured by Vantera and published on this page; no other benefit is implied.'
  ),
  (
    'elite', 'Elite',
    'A higher tier of recognition within the Vantera circle.',
    5000.00, 'USD', 3, true, 12,
    '["Everything in Prestige", "Elite-tier card design", "Member event invitations"]',
    'Membership is issued only after payment verification (1–3 working days). Benefits are configured by Vantera and published on this page; no other benefit is implied.'
  ),
  (
    'sovereign', 'Sovereign',
    'The highest expression of Vantera membership, offered in strictly limited numbers.',
    20000.00, 'USD', 4, true, 12,
    '["Everything in Elite", "Sovereign-tier card design", "Direct line to the membership office"]',
    'Membership is issued only after payment verification (1–3 working days). Benefits are configured by Vantera and published on this page; no other benefit is implied.'
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Site settings — public rows are safe for anonymous readers.
-- Placeholders here are intentionally NOT real payment credentials.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, description, is_public) values
  (
    'brand',
    '{"name": "Vantera", "tagline": "A private circle, issued to a few.", "supportEmail": "", "phone": ""}',
    'Brand name, tagline and public contact details. Fill in before launch.',
    true
  ),
  (
    'contact',
    '{"email": "", "whatsapp": "", "responseTime": "We respond within 2 working days."}',
    'Published contact method shown on /contact. Configure before launch.',
    true
  ),
  (
    'payments.crypto',
    '{"enabled": false, "instructions": "Cryptocurrency payment instructions will appear here once configured by the administrator.", "currencies": []}',
    'Crypto payment configuration: supported assets, networks, receiving addresses. Disabled until an administrator enters real, verified receiving addresses.',
    true
  ),
  (
    'payments.gift_card',
    '{"enabled": false, "reviewNotice": "Gift-card submissions are reviewed manually. Approval is subject to issuer terms and Vantera verification.", "issuers": [], "instructions": "Submit issuer, denomination and proof of purchase only. NEVER submit card PINs or redemption codes."}',
    'Gift-card submission configuration. Disabled until issuer policy is approved by the business.',
    true
  ),
  (
    'payments.verification_notice',
    '{"text": "Payments are verified manually within 1–3 working days (weekends and configured holidays excluded). Submitting payment information does not mean your payment has been approved."}',
    'Payment verification notice shown during checkout.',
    true
  ),
  (
    'business.verification',
    '{"workingDays": 3, "holidays": []}',
    'Verification SLA in working days and optional list of holiday dates (YYYY-MM-DD) excluded from business-day calculations.',
    true
  ),
  (
    'verification.card_display',
    '{"showTier": true, "showExpiry": true}',
    'Controls what the public card-verification page may reveal.',
    true
  ),
  (
    'profile.require_date_of_birth',
    '{"required": false, "minimumAge": 18, "notice": "Date of birth is collected only where the business has confirmed an age-eligibility requirement. It is never displayed publicly and never printed on membership cards."}',
    'Whether date of birth is required at checkout, and the minimum member age. Disabled until the business approves the policy.',
    false
  ),
  (
    'privacy.retention',
    '{"inactiveAccountMonths": 36, "evidenceMonths": 24, "contact": ""}',
    'Documented data retention policy used on the privacy page.',
    true
  )
on conflict (key) do nothing;
