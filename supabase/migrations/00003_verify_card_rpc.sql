-- =============================================================================
-- Vantera — Migration 00003: Public card verification RPC
-- =============================================================================
-- The /verify/<publicIdentifier> page is anonymous by design (QR scans come
-- from anyone holding the card). RLS blocks anonymous reads of card tables,
-- so this SECURITY DEFINER function exposes ONLY the minimal authenticity
-- fields — never names, contact details, addresses, dates of birth, payment
-- data, or user ids.
-- =============================================================================

create or replace function public.verify_card(p_identifier text)
returns table (
  membership_number text,
  membership_status text,
  card_status text,
  tier_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.membership_number,
    m.status::text,
    c.status::text,
    t.name,
    m.expires_at
  from public.membership_cards c
  join public.memberships m on m.id = c.membership_id
  join public.membership_tiers t on t.id = m.tier_id
  where c.public_identifier = lower(p_identifier)
    and p_identifier ~ '^[0-9a-f]{32}$'
  limit 1
$$;

revoke all on function public.verify_card(text) from public;
grant execute on function public.verify_card(text) to anon, authenticated;
