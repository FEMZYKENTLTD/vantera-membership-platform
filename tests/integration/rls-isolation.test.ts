/**
 * RLS isolation tests.
 *
 * These prove the privacy guarantees that unit tests cannot: that a customer
 * session can never read or modify another customer's private rows, never
 * touch admin-only tables, and that payment rows are immutable after schema.
 *
 * RUN MANDUALLY against a disposable local Supabase (`supabase start`):
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service> \
 *   USER_A_EMAIL=a@test.vantera USER_A_PASSWORD=pass12345 \
 *   USER_B_EMAIL=b@test.vantera USER_B_PASSWORD=pass12345 \
 *   npx vitest run tests/integration
 *
 * The suite self-skips without those variables (CI-friendly).
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const creds = {
  a: { email: process.env.USER_A_EMAIL ?? '', password: process.env.USER_A_PASSWORD ?? '' },
  b: { email: process.env.USER_B_EMAIL ?? '', password: process.env.USER_B_PASSWORD ?? '' }
};

const canRun = Boolean(url && anon && service && creds.a.email && creds.b.email);
const d = canRun ? describe : describe.skip;

async function sessionClient(user: { email: string; password: string }) {
  const client = createClient(url!, anon!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });
  if (error) throw new Error(`sign-in failed for ${user.email}: ${error.message}`);
  return client;
}

d('row level security isolation', () => {
  it('a customer cannot read another customer\'s orders', async () => {
    const b = await sessionClient(creds.b);
    const { data: bOrders } = await b.from('orders').select('id');
    expect(bOrders).not.toBeNull();

    const a = await sessionClient(creds.a);
    const { data: crossReads } = await a
      .from('orders')
      .select('id')
      .in('id', (bOrders ?? []).map((o) => o.id));
    expect(crossReads ?? []).toHaveLength(0);
  });

  it('a customer cannot read another customer\'s profile row', async () => {
    const b = await sessionClient(creds.b);
    const { data: me } = await b.from('profiles').select('id').single();
    const a = await sessionClient(creds.a);
    const { data } = await a.from('profiles').select('id').eq('id', me!.id);
    expect(data ?? []).toHaveLength(0);
  });

  it('a customer cannot read payment evidence metadata of others', async () => {
    const b = await sessionClient(creds.b);
    const { data: bEvidence } = await b.from('payment_evidence').select('id');
    const a = await sessionClient(creds.a);
    const { data } = await a
      .from('payment_evidence')
      .select('id')
      .in('id', (bEvidence ?? []).map((e) => e.id));
    expect(data ?? []).toHaveLength(0);
  });

  it('customers can never touch admin-only tables', async () => {
    const a = await sessionClient(creds.a);
    for (const table of ['admin_roles', 'admin_role_permissions', 'audit_logs', 'payment_review_history', 'membership_status_history'] as const) {
      const { data } = await a.from(table).select('*').limit(1);
      expect(data ?? [], `${table} must be invisible to customers`).toHaveLength(0);
    }
  });

  it('customers cannot elevate themselves (no privilege mutation)', async () => {
    const a = await sessionClient(creds.a);
    const insert = await a.from('admin_roles').insert({
      user_id: (await a.auth.getUser()).data.user!.id,
      role_key: 'super_admin'
    });
    expect(insert.error ?? null).not.toBeNull();
  });

  it('payments become immutable for customers after admin review states', async () => {
    // A customer may UPDATE their payment only while it is awaiting evidence —
    // the RLS WITH CHECK clause forbids writes into review states. This test
    // double-checks the customer cannot self-approve their own latest payment.
    const b = await sessionClient(creds.b);
    const { data: payments } = await b.from('payment_evidence').select('payment_id').limit(1);
    if (!payments || payments.length === 0) return; // nothing to probe yet
    const { error } = await b
      .from('payment_submissions')
      .update({ status: 'approved' })
      .eq('id', payments[0].payment_id);
    expect(error ?? null).not.toBeNull();
  });

  it('the verify_card RPC returns no PII ever', async () => {
    const svc = createClient(url!, service!, { auth: { persistSession: false } });
    const { data: cards } = await svc.from('membership_cards').select('public_identifier').limit(1);
    if (!cards || cards.length === 0) return;
    const { data } = await svc.rpc('verify_card', { p_identifier: cards[0].public_identifier });
    const serialized = JSON.stringify(data ?? {});
    for (const leaked of ['email', 'phone', 'user_id', 'full_name', 'date_of_birth', 'address', 'storage_path', 'tx_hash']) {
      expect(serialized.toLowerCase()).not.toContain(leaked);
    }
  });

  // --- Audit 2026-10-16 regression coverage ---------------------------------

  it('H1: customers CANNOT insert orders directly (create_order RPC only)', async () => {
    const a = await sessionClient(creds.a);
    const { data: tiers } = await a.from('membership_tiers').select('id').limit(1);
    expect(tiers?.length).toBeGreaterThan(0);
    const forged = await a.from('orders').insert({
      user_id: (await a.auth.getUser()).data.user!.id,
      tier_id: tiers![0].id,
      tier_name_snapshot: 'Fake',
      unit_price: 0.01,
      currency: 'USD',
      total_price: 0.01
    });
    expect(forged.error).not.toBeNull(); // no INSERT policy → FORCED denial
  });

  it('H1: create_order RPC returns a server-side snapshot (no forged prices)', async () => {
    const a = await sessionClient(creds.a);
    const { data: tiers } = await a.from('membership_tiers').select('id, price').limit(1);
    if (!tiers?.length) return;
    const { data: rows, error } = await a.rpc('create_order', { p_tier_id: tiers[0].id });
    expect(error).toBeNull();
    expect(rows?.[0]?.id).toBeTruthy();
    const { data: order } = await a
      .from('orders')
      .select('unit_price, total_price')
      .eq('id', rows![0].id)
      .single();
    expect(Number(order!.unit_price)).toBe(Number(tiers[0].price));
    expect(Number(order!.total_price)).toBe(Number(order!.unit_price));
  });

  it('H2: an order can hold at most ONE open payment submission', async () => {
    const a = await sessionClient(creds.a);
    const { data: orders } = await a.from('orders').select('id').order('created_at', { ascending: false }).limit(1);
    if (!orders?.length) return; // fixture order must exist (create via RPC if missing)
    const { data: existing } = await a
      .from('payment_submissions')
      .select('id')
      .eq('order_id', orders[0].id)
      .limit(1);
    if (!existing?.length) {
      // file a first submission, then attempt a second
      const userId = (await a.auth.getUser()).data.user!.id;
      const first = await a.from('payment_submissions').insert({
        order_id: orders[0].id,
        user_id: userId,
        method: 'crypto',
        status: 'pending_review',
        crypto_currency: 'BTC',
        network: 'Bitcoin',
        expected_amount: 1
      });
      expect(first.error, `first submission failed: ${first.error?.message}`).toBeNull();
    }
    const second = await a.from('payment_submissions').insert({
      order_id: orders[0].id,
      user_id: (await a.auth.getUser()).data.user!.id,
      method: 'crypto',
      status: 'pending_review',
      crypto_currency: 'BTC',
      network: 'Bitcoin',
      expected_amount: 1
    });
    expect(second.error ?? null, 'second OPEN payment must violate one_open_payment_per_order').not.toBeNull();
  });

  it('H2: customers cannot UPDATE payment rows directly (resubmission is guarded)', async () => {
    const a = await sessionClient(creds.a);
    const { data: payments } = await a.from('payment_submissions').select('id').limit(1);
    if (!payments?.length) return;
    const res = await a
      .from('payment_submissions')
      .update({ submitter_notes: 'tampered' })
      .eq('id', payments[0].id);
    expect(res.error ?? null).not.toBeNull(); // no UPDATE policy for members
  });
});
