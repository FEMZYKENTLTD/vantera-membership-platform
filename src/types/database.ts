/**
 * Database types for the Vantera platform.
 *
 * Hand-maintained to mirror supabase/migrations. Regenerate from a live
 * project with:  supabase gen types typescript --project-id <ref>
 * then reconcile carefully.
 */

export type OrderStatus =
  | 'awaiting_payment'
  | 'payment_submitted'
  | 'under_review'
  | 'payment_approved'
  | 'payment_rejected'
  | 'additional_information_required'
  | 'membership_processing'
  | 'card_ready'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'crypto' | 'gift_card';

export type PaymentStatus =
  | 'submitted'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'additional_information_required';

export type MembershipStatus =
  | 'pending'
  | 'processing'
  | 'card_ready'
  | 'active'
  | 'suspended'
  | 'revoked'
  | 'expired'
  | 'cancelled';

export type CardStatus = 'awaiting_upload' | 'in_preparation' | 'ready' | 'revoked';

export type ProfileStatus = 'active' | 'suspended' | 'closed';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  date_of_birth: string | null;
  date_of_birth_captured_at: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export type MembershipTierRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number | string;
  currency: string;
  display_order: number;
  is_published: boolean;
  duration_months: number | null;
  benefits: Json;
  terms: string;
  created_at: string;
  updated_at: string;
}

export type OrderRow = {
  id: string;
  reference: string;
  user_id: string;
  tier_id: string;
  tier_name_snapshot: string;
  unit_price: number | string;
  currency: string;
  total_price: number | string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export type PaymentSubmissionRow = {
  id: string;
  order_id: string;
  user_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  crypto_currency: string | null;
  network: string | null;
  expected_amount: number | string | null;
  tx_hash: string | null;
  paid_at: string | null;
  gift_card_issuer: string | null;
  gift_card_denomination: number | string | null;
  gift_card_currency: string | null;
  purchase_reference: string | null;
  submitter_notes: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type PaymentEvidenceRow = {
  id: string;
  payment_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export type MembershipRow = {
  id: string;
  membership_number: string;
  user_id: string;
  order_id: string;
  tier_id: string;
  status: MembershipStatus;
  issued_at: string | null;
  expires_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type MembershipCardRow = {
  id: string;
  membership_id: string;
  public_identifier: string;
  status: CardStatus;
  current_version_id: string | null;
  ready_at: string | null;
  ready_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type MembershipCardVersionRow = {
  id: string;
  card_id: string;
  version: number;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  replaced_reason: string | null;
  created_at: string;
}

export type AdminRoleRow = {
  id: string;
  user_id: string;
  role_key: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export type AdminRolePermissionRow = {
  id: string;
  role_id: string;
  permission_key: string;
  granted_by: string | null;
  created_at: string;
}

export type AdminPermissionRow = {
  key: string;
  description: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Json;
  read_at: string | null;
  created_at: string;
}

export type PaymentReviewHistoryRow = {
  id: string;
  payment_id: string;
  previous_status: PaymentStatus | null;
  new_status: PaymentStatus;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
}

export type MembershipStatusHistoryRow = {
  id: string;
  membership_id: string;
  previous_status: MembershipStatus | null;
  new_status: MembershipStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_state: string | null;
  new_state: string | null;
  metadata: Json;
  created_at: string;
}

export type SiteSettingRow = {
  key: string;
  value: Json;
  description: string;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
}

/** Convenience row-with-relations shapes used by pages. */
export type OrderWithTier = OrderRow & { membership_tiers: MembershipTierRow | null };
export type PaymentWithOrder = PaymentSubmissionRow & {
  orders: OrderRow | null;
};
export type MembershipFull = MembershipRow & {
  membership_tiers: MembershipTierRow | null;
  membership_cards: MembershipCardRow[] | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      membership_tiers: {
        Row: MembershipTierRow;
        Insert: Omit<MembershipTierRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<MembershipTierRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Pick<OrderRow, 'user_id' | 'tier_id'> &
          Partial<OrderRow>;
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      payment_submissions: {
        Row: PaymentSubmissionRow;
        Insert: Pick<PaymentSubmissionRow, 'order_id' | 'user_id' | 'method'> &
          Partial<PaymentSubmissionRow>;
        Update: Partial<PaymentSubmissionRow>;
        Relationships: [];
      };
      payment_evidence: {
        Row: PaymentEvidenceRow;
        Insert: Omit<PaymentEvidenceRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<PaymentEvidenceRow>;
        Relationships: [];
      };
      memberships: {
        Row: MembershipRow;
        Insert: Pick<MembershipRow, 'user_id' | 'order_id' | 'tier_id'> &
          Partial<MembershipRow>;
        Update: Partial<MembershipRow>;
        Relationships: [];
      };
      membership_cards: {
        Row: MembershipCardRow;
        Insert: Pick<MembershipCardRow, 'membership_id'> &
          Partial<MembershipCardRow>;
        Update: Partial<MembershipCardRow>;
        Relationships: [];
      };
      membership_card_versions: {
        Row: MembershipCardVersionRow;
        Insert: Omit<MembershipCardVersionRow, 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<MembershipCardVersionRow>;
        Relationships: [];
      };
      admin_roles: {
        Row: AdminRoleRow;
        Insert: Pick<AdminRoleRow, 'user_id' | 'role_key'> & Partial<AdminRoleRow>;
        Update: Partial<AdminRoleRow>;
        Relationships: [];
      };
      admin_role_permissions: {
        Row: AdminRolePermissionRow;
        Insert: Pick<AdminRolePermissionRow, 'role_id' | 'permission_key'> &
          Partial<AdminRolePermissionRow>;
        Update: Partial<AdminRolePermissionRow>;
        Relationships: [];
      };
      admin_permissions: {
        Row: AdminPermissionRow;
        Insert: AdminPermissionRow;
        Update: Partial<AdminPermissionRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Pick<NotificationRow, 'user_id' | 'type' | 'title'> &
          Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      payment_review_history: {
        Row: PaymentReviewHistoryRow;
        Insert: Pick<PaymentReviewHistoryRow, 'payment_id' | 'new_status'> &
          Partial<PaymentReviewHistoryRow>;
        Update: Partial<PaymentReviewHistoryRow>;
        Relationships: [];
      };
      membership_status_history: {
        Row: MembershipStatusHistoryRow;
        Insert: Pick<MembershipStatusHistoryRow, 'membership_id' | 'new_status'> &
          Partial<MembershipStatusHistoryRow>;
        Update: Partial<MembershipStatusHistoryRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Pick<AuditLogRow, 'action' | 'entity_type'> & Partial<AuditLogRow>;
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      site_settings: {
        Row: SiteSettingRow;
        Insert: Pick<SiteSettingRow, 'key' | 'value'> & Partial<SiteSettingRow>;
        Update: Partial<SiteSettingRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      has_permission: {
        Args: { p_permission: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      create_order: {
        Args: { p_tier_id: string };
        Returns: {
          id: string;
          reference: string;
          created: boolean;
        }[];
      };
      verify_card: {
        Args: { p_identifier: string };
        Returns: {
          membership_number: string;
          membership_status: string;
          card_status: string;
          tier_name: string;
          expires_at: string | null;
        }[];
      };
    };
    Enums: {
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      membership_status: MembershipStatus;
      card_status: CardStatus;
      profile_status: ProfileStatus;
    };
  };
}
