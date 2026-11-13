export type UserRole = 'admin' | 'seller'
export type QuoteStatus = 'draft' | 'issued' | 'cancelled' | 'expired'

export interface Organization {
  id: string
  display_name: string
  legal_name: string | null
  logo_storage_key: string | null
  brand_primary_color: string
  brand_secondary_color: string
  contact_phone: string | null
  contact_email: string | null
  address: string | null
  currency: string
  timezone: string
  quote_prefix: string
  next_quote_number: number
  default_validity_days: number | null
  template_version: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id?: string
  quote_id?: string
  position: number
  description: string
  quantity: number
  unit: string | null
  unit_price_cents: number
  line_total_cents: number
  created_at?: string
}

export interface Quote {
  id: string
  organization_id: string
  quote_number: string | null
  quote_sequence: number | null
  version: number
  status: QuoteStatus
  seller_user_id: string
  seller_name_snapshot: string | null
  seller_phone_snapshot: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_tax_id: string | null
  notes: string | null
  payment_terms: string | null
  cancel_reason: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  issued_at: string | null
  valid_until: string | null
  currency: string
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  template_version: number
  pdf_storage_key: string | null
  created_at: string
  updated_at: string
  items?: QuoteItem[]
  seller?: Pick<Profile, 'full_name' | 'phone' | 'email'>
  organization?: Organization
}

/** Linha da view pública `quote_list` (status já derivado). */
export interface QuoteListRow {
  id: string
  organization_id: string
  quote_number: string | null
  quote_sequence: number | null
  version: number
  status: QuoteStatus
  stored_status: Exclude<QuoteStatus, 'expired'>
  seller_user_id: string
  seller_name: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_tax_id: string | null
  notes: string | null
  payment_terms: string | null
  issued_at: string | null
  valid_until: string | null
  currency: string
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

export interface QuoteMetrics {
  total_count: number
  issued_count: number
  draft_count: number
  cancelled_count: number
  expired_count: number
  active_volume_cents: number
  issued_volume_cents?: number
  draft_volume_cents?: number
}

export interface AuditEvent {
  id: string
  organization_id: string
  actor_user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  metadata: Record<string, unknown> | null
  request_id: string | null
  created_at: string
}
