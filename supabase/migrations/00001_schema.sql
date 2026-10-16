-- =============================================================================
-- Vantera Membership Platform — Migration 00001: Schema
-- =============================================================================
-- Timezone behaviour: ALL timestamps are stored as timestamptz (UTC).
-- Rendering to local time is an application concern.
-- Money: numeric(14,2) major units with an ISO-4217 char(3) currency code.
--        Crypto expected amounts use numeric(28,8). No floating point anywhere.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

create type public.order_status as enum (
  'awaiting_payment',
  'payment_submitted',
  'under_review',
  'payment_approved',
  'payment_rejected',
  'additional_information_required',
  'membership_processing',
  'card_ready',
  'completed',
  'cancelled'
);

create type public.payment_method as enum ('crypto', 'gift_card');

create type public.payment_status as enum (
  'submitted',
  'pending_review',
  'under_review',
  'approved',
  'rejected',
  'additional_information_required'
);

create type public.membership_status as enum (
  'pending',
  'processing',
  'card_ready',
  'active',
  'suspended',
  'revoked',
  'expired',
  'cancelled'
);

create type public.card_status as enum (
  'awaiting_upload',
  'in_preparation',
  'ready',
  'revoked'
);

create type public.profile_status as enum ('active', 'suspended', 'closed');

-- ---------------------------------------------------------------------------
-- profiles — extends Supabase auth.users (never store passwords here)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  -- Date of birth is OPTIONAL and only collected when the business enables it
  -- via site_settings ('profile.require_date_of_birth'). Privacy notice is
  -- shown before it is required. Kept as a plain date (least revealing form).
  date_of_birth date,
  date_of_birth_captured_at timestamptz,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint full_name_len check (char_length(full_name) <= 200),
  constraint phone_len check (phone is null or char_length(phone) <= 40),
  constraint plausible_dob check (
    date_of_birth is null
    or (date_of_birth > date '1900-01-01' and date_of_birth < current_date)
  )
);

-- Auto-create a profile when a user registers through Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- membership_tiers — the four configurable packages
-- ---------------------------------------------------------------------------

create table public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price numeric(14, 2) not null,
  currency char(3) not null default 'USD',
  display_order integer not null default 0,
  is_published boolean not null default false,
  -- NULL = no fixed duration / does not expire by time
  duration_months integer,
  benefits jsonb not null default '[]'::jsonb,
  terms text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_non_negative check (price >= 0),
  constraint slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint benefits_is_array check (jsonb_typeof(benefits) = 'array'),
  constraint duration_positive check (duration_months is null or duration_months > 0)
);

-- ---------------------------------------------------------------------------
-- orders — one order per membership purchase; preserves price snapshot
-- ---------------------------------------------------------------------------

create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Server-generated, human-friendly order reference shared with the customer.
  reference text not null unique default (
    'VNT-' || lpad(nextval('public.order_number_seq')::text, 6, '0')
  ),
  user_id uuid not null references public.profiles (id) on delete restrict,
  tier_id uuid not null references public.membership_tiers (id) on delete restrict,
  -- Price snapshots taken from the tier AT ORDER CREATION TIME on the server.
  tier_name_snapshot text not null,
  unit_price numeric(14, 2) not null,
  currency char(3) not null,
  total_price numeric(14, 2) not null,
  status public.order_status not null default 'awaiting_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint unit_price_non_negative check (unit_price >= 0),
  constraint total_price_non_negative check (total_price >= 0)
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_tier_idx on public.orders (tier_id);

-- ---------------------------------------------------------------------------
-- payment_submissions — customer-declared payment information for review.
-- A submission is NEVER proof of payment. Manual admin review is required.
-- ---------------------------------------------------------------------------

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  -- Denormalised owner so policies and lookups never need to join orders.
  -- A trigger guarantees it always matches orders.user_id.
  user_id uuid not null references public.profiles (id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending_review',

  -- Cryptocurrency fields (only populated when method = 'crypto')
  crypto_currency text,
  network text,
  expected_amount numeric(28, 8),
  tx_hash text,
  paid_at timestamptz,

  -- Gift card fields (only populated when method = 'gift_card').
  -- SECURITY: NEVER store gift-card PINs, redemption codes or claim codes.
  -- Issuer, denomination, purchase reference and evidence only.
  gift_card_issuer text,
  gift_card_denomination numeric(14, 2),
  gift_card_currency char(3),
  purchase_reference text,

  submitter_notes text,
  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  version integer not null default 0, -- optimistic concurrency for review actions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crypto_fields_required check (
    method <> 'crypto'
    or (crypto_currency is not null and network is not null and expected_amount is not null)
  ),
  constraint gift_card_fields_required check (
    method <> 'gift_card'
    or (gift_card_issuer is not null and gift_card_denomination is not null
        and gift_card_currency is not null)
  ),
  constraint tx_hash_format check (
    tx_hash is null or tx_hash ~ '^[a-zA-Z0-9]{8,128}$'
  ),
  constraint expected_amount_positive check (
    expected_amount is null or expected_amount > 0
  ),
  constraint denomination_positive check (
    gift_card_denomination is null or gift_card_denomination > 0
  )
);

-- Prevent the same on-chain transaction being processed twice.
create unique index payment_tx_hash_unique
  on public.payment_submissions (network, lower(tx_hash))
  where tx_hash is not null;

create index payment_order_idx on public.payment_submissions (order_id, created_at desc);
create index payment_user_idx on public.payment_submissions (user_id, created_at desc);
create index payment_status_idx on public.payment_submissions (status);
create index payment_method_status_idx on public.payment_submissions (method, status);

-- Guarantee payment_submissions.user_id always equals the owning order's user.
create or replace function public.enforce_payment_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.orders where id = new.order_id;
  if owner is null then
    raise exception 'order % does not exist', new.order_id;
  end if;
  if new.user_id is distinct from owner then
    raise exception 'payment_submissions.user_id must equal the order owner';
  end if;
  return new;
end;
$$;

create trigger payment_owner_check
  before insert or update on public.payment_submissions
  for each row execute function public.enforce_payment_owner();

-- ---------------------------------------------------------------------------
-- payment_evidence — metadata ONLY for files in the private
-- 'payment-evidence' storage bucket. Paths are private object paths,
-- never public URLs.
-- ---------------------------------------------------------------------------

create table public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payment_submissions (id) on delete cascade,
  storage_bucket text not null default 'payment-evidence',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint evidence_size check (size_bytes > 0 and size_bytes <= 26214400), -- 25 MB hard cap
  constraint evidence_mime check (
    mime_type in ('image/png', 'image/jpeg', 'application/pdf')
  )
);

create index evidence_payment_idx on public.payment_evidence (payment_id);

-- ---------------------------------------------------------------------------
-- memberships — issued only after payment approval (+ required checks)
-- ---------------------------------------------------------------------------

create sequence public.membership_number_seq start 1;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  membership_number text not null unique default (
    'VNT-M-' || lpad(nextval('public.membership_number_seq')::text, 6, '0')
  ),
  user_id uuid not null references public.profiles (id) on delete restrict,
  order_id uuid not null unique references public.orders (id) on delete restrict,
  tier_id uuid not null references public.membership_tiers (id) on delete restrict,
  status public.membership_status not null default 'pending',
  issued_at timestamptz,
  expires_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_status_idx on public.memberships (status);

-- ---------------------------------------------------------------------------
-- membership_cards + membership_card_versions
-- Card artwork is designed outside the app and uploaded by an authorised
-- designer/administrator. Every upload creates a new immutable version.
-- ---------------------------------------------------------------------------

create table public.membership_cards (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.memberships (id) on delete cascade,
  -- Random, non-guessable public identifier used by the QR verification page.
  -- It grants NO access to private data and is NOT an authentication secret.
  public_identifier text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status public.card_status not null default 'awaiting_upload',
  current_version_id uuid,
  ready_at timestamptz,
  ready_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_public_id_idx on public.membership_cards (public_identifier);

create table public.membership_card_versions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.membership_cards (id) on delete cascade,
  version integer not null,
  storage_bucket text not null default 'membership-cards',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  replaced_reason text,
  created_at timestamptz not null default now(),
  constraint card_version_size check (size_bytes > 0 and size_bytes <= 26214400),
  constraint card_version_mime check (
    mime_type in ('image/png', 'image/jpeg', 'application/pdf')
  ),
  constraint card_version_unique unique (card_id, version)
);

alter table public.membership_cards
  add constraint cards_current_version_fk
  foreign key (current_version_id) references public.membership_card_versions (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- admin roles & permissions (server-controlled; no public grant path)
-- ---------------------------------------------------------------------------

create table public.admin_permissions (
  key text primary key,
  description text not null default ''
);

create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_key text not null, -- e.g. super_admin, payments_admin, designer, support
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_role_unique unique (user_id, role_key)
);

create table public.admin_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.admin_roles (id) on delete cascade,
  permission_key text not null references public.admin_permissions (key) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint role_permission_unique unique (role_id, permission_key)
);

-- Permission check used by RLS policies and server code.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_roles r
    join public.admin_role_permissions rp on rp.role_id = r.id
    where r.user_id = (select auth.uid())
      and r.is_active
      and rp.permission_key = p_permission
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid()) and r.is_active
  )
$$;

-- ---------------------------------------------------------------------------
-- notifications — in-app notification centre (email is best-effort on top)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- status histories (immutable; insert-only through the application)
-- ---------------------------------------------------------------------------

create table public.payment_review_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payment_submissions (id) on delete cascade,
  previous_status public.payment_status,
  new_status public.payment_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index payment_review_history_idx
  on public.payment_review_history (payment_id, created_at desc);

create table public.membership_status_history (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  previous_status public.membership_status,
  new_status public.membership_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index membership_status_history_idx
  on public.membership_status_history (membership_id, created_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs — security-relevant administrative events. The app grants no
-- update/delete path; rows are written by the service role only.
-- NEVER log passwords, tokens, gift-card secrets, private keys or seed phrases.
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_state text,
  new_state text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- ---------------------------------------------------------------------------
-- site_settings — administrator-editable configuration.
-- is_public = true rows may be read anonymously (contact details, payment
-- instructions, verification notices). Everything else is admin-only.
-- ---------------------------------------------------------------------------

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_tiers before update on public.membership_tiers
  for each row execute function public.touch_updated_at();
create trigger touch_orders before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger touch_payments before update on public.payment_submissions
  for each row execute function public.touch_updated_at();
create trigger touch_memberships before update on public.memberships
  for each row execute function public.touch_updated_at();
create trigger touch_cards before update on public.membership_cards
  for each row execute function public.touch_updated_at();

-- Audit every published price change (orders keep their own snapshots).
create or replace function public.audit_tier_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price is distinct from old.price or new.currency is distinct from old.currency then
    insert into public.audit_logs
      (actor_id, action, entity_type, entity_id, previous_state, new_state, metadata)
    values (
      auth.uid(),
      'tier.price_changed',
      'membership_tiers',
      new.id,
      old.price::text || ' ' || old.currency,
      new.price::text || ' ' || new.currency,
      jsonb_build_object('tier_name', new.name, 'slug', new.slug)
    );
  end if;
  return new;
end;
$$;

create trigger tier_price_audit
  after update on public.membership_tiers
  for each row execute function public.audit_tier_price_change();
