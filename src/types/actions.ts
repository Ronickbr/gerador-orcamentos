import type { QuotePayload } from '@/lib/validation'
import type { Profile } from '@/types/database'

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string }

export interface SaveQuoteInput {
  /** id gerado no cliente; permite repetição segura do mesmo envio */
  quoteId: string
  expectedVersion: number | null
  requestId: string
  payload: QuotePayload
}

export interface SaveQuoteResult {
  success: true
  quote_id: string
  version: number
  subtotal_cents: number
  discount_cents?: number
  total_cents: number
  idempotent?: boolean
}

export interface IssueQuoteResult {
  success: true
  quote_id: string
  quote_number: string | null
  quote_sequence: number | null
  status: string
  version: number
  idempotent?: boolean
}

export interface CancelQuoteResult {
  success: true
  status: string
  version: number
  idempotent?: boolean
}

export interface SellerInput {
  fullName: string
  phone: string
  role: 'admin' | 'seller'
  active: boolean
}

export interface CreateSellerInput extends SellerInput {
  email: string
  password: string
}

export interface UpdateProfileInput {
  fullName: string
  phone?: string | null
  newPassword?: string
}

export type SellerResult = ActionResult<Profile>
