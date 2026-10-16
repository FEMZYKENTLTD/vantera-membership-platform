-- =============================================================================
-- Vantera — Migration 00004: Security hardening (2026-10-16 independent audit)
-- =============================================================================
-- H1: Order creation moves behind a SECURITY DEFINER function so the price
--     snapshot is enforced at the database boundary (the prior insert policy
--     let any signed-in user supply arbitrary unit_price/snapshot fields via
--     a direct REST insert). Direct member INSERT on orders is revoked.
--
-- H2: A partial unique index guarantees at most one OPEN payment submission
--     per order — eliminating the check-then-insert race that allowed two
--     concurrent submissions for the same order. Re-submission after an
--     information request happens by replacing that same row in place.
--
-- M3: The open-order cap is enforced inside the create_order function under
--     a per-user advisory lock, so concurrent calls serialise.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (H2) At most one open payment submission per order
-- ---------------------------------------------------------------------------
create unique index if not exists one_open_payment_per_order
  on public.payment_submissions (order_id)
  where status in ('submitted', 'pending_review', 'under_review',
                   'additional_information_required');

-- ---------------------------------------------------------------------------
-- (H1/H3) Authenticated users may no longer INSERT orders directly.
-- Order creation exclusively via public.create_order(p_tier_id).
-- ---------------------------------------------------------------------------
drop policy if exists orders_self_insert on public.orders;

create or replace function public.create_order(p_tier_id uuid)
returns table (id uuid, reference text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_status  text;
  v_open    int;
  v_existing record;
  v_tier     record;
  v_order    record;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- Serialise concurrent creations for the same member (open-order cap race).
  -- Two-argument form: fixed app key + per-user key (no int4 overflow).
  perform pg_advisory_xact_lock(7843, hashtext(v_user::text));

  -- Only active profiles may order.
  select p.status into v_status from public.profiles p where p.id = v_user;
  if v_status is distinct from 'active' then
    raise exception 'profile_not_active';
  end if;

  -- Load the tier inside the transaction: the snapshot below is taken from
  -- THIS row, server-side, and can never be influenced by the caller.
  select t.id, t.name, t.price, t.currency
    into v_tier
    from public.membership_tiers t
    where t.id = p_tier_id and t.is_published;
  if v_tier is null then
    raise exception 'tier_not_available';
  end if;

  -- True idempotency: a duplicate submission of the same tier reuses the
  -- existing open order instead of creating a second one.
  select o.id, o.reference into v_existing
    from public.orders o
    where o.user_id = v_user
      and o.tier_id = v_tier.id
      and o.status = 'awaiting_payment'
    order by o.created_at
    limit 1;
  if v_existing.id is not null then
    id := v_existing.id;
    reference := v_existing.reference;
    created := false;
    return next;
    return;
  end if;

  -- Open-order cap, evaluated under the advisory lock.
  select count(*) into v_open
    from public.orders o
    where o.user_id = v_user
      and o.status in (
        'awaiting_payment', 'payment_submitted', 'under_review',
        'payment_approved', 'additional_information_required',
        'membership_processing', 'card_ready'
      );
  if v_open >= 3 then
    raise exception 'open_order_limit';
  end if;

  insert into public.orders (
    user_id, tier_id, tier_name_snapshot,
    unit_price, currency, total_price
  ) values (
    v_user, v_tier.id, v_tier.name,
    v_tier.price, v_tier.currency, v_tier.price
  )
  returning orders.id, orders.reference into v_order;

  id := v_order.id;
  reference := v_order.reference;
  created := true;
  return next;
end;
$$;

revoke all on function public.create_order(uuid) from public;
grant execute on function public.create_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Consistency note: payment_resubmission replaces fields of the SAME row
-- (enforced in server actions with a status-conditional update and the
-- partial unique index above), keeping a single auditable payment per order
-- in flight at any time.
-- ---------------------------------------------------------------------------
