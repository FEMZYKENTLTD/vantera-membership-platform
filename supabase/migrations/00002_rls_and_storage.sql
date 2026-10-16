-- =============================================================================
-- Vantera — Migration 00002: Row Level Security policies + private storage
-- =============================================================================
-- Principles:
--  * Default deny: RLS enabled everywhere, policies are explicit.
--  * Browser (anon/authenticated) clients can only ever see a customer's own
--    records or intentionally published data.
--  * Privileged mutations (payment approval, membership status, roles, card
--    issuance) require a specific admin permission — enforced again, with
--    audit logging, in server-side code that uses the service role.
--  * audit_logs / status histories are insert-only via the service role;
--    the service role bypasses RLS, so no INSERT policies exist for them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('customers.view'));

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  -- Users may never change their own account status.
  with check (id = auth.uid() and status = 'active');

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));

-- No INSERT/DELETE policy: rows come from the auth trigger (service) only.

-- ---------------------------------------------------------------------------
-- membership_tiers — published tiers are public; everything else admin-only
-- ---------------------------------------------------------------------------
alter table public.membership_tiers enable row level security;

create policy tiers_public_read on public.membership_tiers
  for select to anon, authenticated
  using (is_published or public.has_permission('packages.manage')
         or public.has_permission('orders.view'));

create policy tiers_admin_write on public.membership_tiers
  for insert to authenticated
  with check (public.has_permission('packages.manage'));

create policy tiers_admin_update on public.membership_tiers
  for update to authenticated
  using (public.has_permission('packages.manage'))
  with check (public.has_permission('packages.manage'));

-- No DELETE policy: tiers are retired by un-publishing, never deleted,
-- so historical order snapshots always resolve.

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

create policy orders_self_read on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('orders.view'));

create policy orders_self_insert on public.orders
  for insert to authenticated
  -- user_id must be self; the server action overwrites the snapshot fields
  -- from the tier row regardless of anything the browser sends.
  with check (user_id = auth.uid());

create policy orders_admin_update on public.orders
  for update to authenticated
  using (public.has_permission('orders.manage'))
  with check (public.has_permission('orders.manage'));

-- Customers cannot UPDATE orders (status is server-controlled).

-- ---------------------------------------------------------------------------
-- payment_submissions
-- ---------------------------------------------------------------------------
alter table public.payment_submissions enable row level security;

create policy payments_self_read on public.payment_submissions
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('payments.review'));

create policy payments_self_insert on public.payment_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    -- a customer can only ever create a submission awaiting review
    and status in ('pending_review', 'submitted')
  );

create policy payments_admin_update on public.payment_submissions
  for update to authenticated
  using (public.has_permission('payments.review'))
  with check (public.has_permission('payments.review'));

-- No customer UPDATE: customers can never approve/edit reviewed payments.
-- (Server actions use the service role for additional customer-facing
--  corrections such as re-submitting evidence, if enabled.)

-- ---------------------------------------------------------------------------
-- payment_evidence
-- ---------------------------------------------------------------------------
alter table public.payment_evidence enable row level security;

create policy evidence_self_read on public.payment_evidence
  for select to authenticated
  using (
    public.has_permission('payments.review')
    or exists (
      select 1 from public.payment_submissions p
      where p.id = payment_id and p.user_id = auth.uid()
    )
  );

create policy evidence_self_insert on public.payment_evidence
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.payment_submissions p
      where p.id = payment_id and p.user_id = auth.uid()
    )
  );

-- No UPDATE/DELETE via clients: evidence is immutable once uploaded.

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
alter table public.memberships enable row level security;

create policy memberships_self_read on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('memberships.manage'));

create policy memberships_admin_insert on public.memberships
  for insert to authenticated
  with check (public.has_permission('memberships.manage'));

create policy memberships_admin_update on public.memberships
  for update to authenticated
  using (public.has_permission('memberships.manage'))
  with check (public.has_permission('memberships.manage'));

-- ---------------------------------------------------------------------------
-- membership_cards / versions
-- Customers read only their own cards. Uploads go through the service role
-- after a 'cards.manage' permission check; admins with cards.manage may also
-- write directly (still audited by the server-side action wrappers).
-- ---------------------------------------------------------------------------
alter table public.membership_cards enable row level security;

create policy cards_self_read on public.membership_cards
  for select to authenticated
  using (
    public.has_permission('cards.manage')
    or exists (
      select 1 from public.memberships m
      where m.id = membership_id and m.user_id = auth.uid()
    )
  );

create policy cards_admin_insert on public.membership_cards
  for insert to authenticated
  with check (public.has_permission('cards.manage'));

create policy cards_admin_update on public.membership_cards
  for update to authenticated
  using (public.has_permission('cards.manage'))
  with check (public.has_permission('cards.manage'));

alter table public.membership_card_versions enable row level security;

create policy card_versions_self_read on public.membership_card_versions
  for select to authenticated
  using (
    public.has_permission('cards.manage')
    or exists (
      select 1
      from public.membership_cards c
      join public.memberships m on m.id = c.membership_id
      where c.id = card_id and m.user_id = auth.uid()
    )
  );

create policy card_versions_admin_insert on public.membership_card_versions
  for insert to authenticated
  with check (public.has_permission('cards.manage'));

-- No UPDATE/DELETE on versions: history is immutable.

-- ---------------------------------------------------------------------------
-- admin roles & permissions — no self-service grants, ever
-- ---------------------------------------------------------------------------
alter table public.admin_permissions enable row level security;

create policy permissions_admin_read on public.admin_permissions
  for select to authenticated
  using (public.has_permission('roles.manage'));

alter table public.admin_roles enable row level security;

-- A user may inspect their OWN roles (used to shape UI), but cannot write.
create policy roles_self_read on public.admin_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('roles.manage'));

create policy roles_admin_insert on public.admin_roles
  for insert to authenticated
  with check (
    public.has_permission('roles.manage')
    and user_id <> auth.uid() -- cannot grant roles to yourself
  );

create policy roles_admin_update on public.admin_roles
  for update to authenticated
  using (public.has_permission('roles.manage') and user_id <> auth.uid())
  with check (public.has_permission('roles.manage') and user_id <> auth.uid());

alter table public.admin_role_permissions enable row level security;

create policy role_permissions_read on public.admin_role_permissions
  for select to authenticated
  using (
    public.has_permission('roles.manage')
    or exists (
      select 1 from public.admin_roles r
      where r.id = role_id and r.user_id = auth.uid()
    )
  );

create policy role_permissions_admin_insert on public.admin_role_permissions
  for insert to authenticated
  with check (public.has_permission('roles.manage'));

create policy role_permissions_admin_delete on public.admin_role_permissions
  for delete to authenticated
  using (public.has_permission('roles.manage'));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_self_read on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_self_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT only via service role (server code).

-- ---------------------------------------------------------------------------
-- histories & audit logs — readable with permission, never writable by clients
-- ---------------------------------------------------------------------------
alter table public.payment_review_history enable row level security;

create policy payment_review_history_read on public.payment_review_history
  for select to authenticated
  using (
    public.has_permission('payments.review')
    or exists (
      select 1 from public.payment_submissions p
      where p.id = payment_id and p.user_id = auth.uid()
    )
  );

alter table public.membership_status_history enable row level security;

create policy membership_status_history_read on public.membership_status_history
  for select to authenticated
  using (
    public.has_permission('memberships.manage')
    or exists (
      select 1 from public.memberships m
      where m.id = membership_id and m.user_id = auth.uid()
    )
  );

alter table public.audit_logs enable row level security;

create policy audit_logs_read on public.audit_logs
  for select to authenticated
  using (public.has_permission('audit.view'));

-- ---------------------------------------------------------------------------
-- site_settings
-- ---------------------------------------------------------------------------
alter table public.site_settings enable row level security;

create policy settings_public_read on public.site_settings
  for select to anon, authenticated
  using (is_public or public.has_permission('settings.manage'));

create policy settings_admin_write on public.site_settings
  for insert to authenticated
  with check (public.has_permission('settings.manage'));

create policy settings_admin_update on public.site_settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- Private storage buckets (service role manages all objects; browser clients
-- get short-lived signed URLs only after a server-side authorisation check)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-evidence', 'payment-evidence', false, 26214400,
   array['image/png', 'image/jpeg', 'application/pdf']),
  ('membership-cards', 'membership-cards', false, 26214400,
   array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do nothing;

-- Customers may upload evidence only into their own folder:
--   payment-evidence/<their-auth-uid>/...
create policy evidence_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy evidence_storage_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reviewers read evidence objects (metadata table policy governs listing;
-- downloads in the app are issued as signed URLs by the service role).
create policy evidence_storage_read_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-evidence' and public.has_permission('payments.review'));

-- Membership card objects: owner can read their card folder via signed URL
-- flow; direct storage read allowed for owner + cards.manage holders.
-- Card paths are: membership-cards/<membership_id>/...
create policy card_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'membership-cards'
    and (
      public.has_permission('cards.manage')
      or exists (
        select 1 from public.memberships m
        where m.id::text = (storage.foldername(name))[1]
          and m.user_id = auth.uid()
      )
    )
  );

create policy card_storage_write_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'membership-cards' and public.has_permission('cards.manage'));

create policy card_storage_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'membership-cards' and public.has_permission('cards.manage'));
