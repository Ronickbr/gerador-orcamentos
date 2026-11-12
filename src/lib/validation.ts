import { parseQuantity } from '@/lib/utils'

export interface QuoteItemValues {
  key: string
  description: string
  /** Mantido como texto para aceitar "1,5" sem truncar. */
  quantity: string
  unit: string
  unitPriceCents: number
}

export interface QuoteFormValues {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerTaxId: string
  paymentTerms: string
  notes: string
  validityDays: string
  discountCents: number
  items: QuoteItemValues[]
}

export interface QuotePayload {
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_tax_id: string | null
  notes: string | null
  payment_terms: string | null
  discount_cents: number
  validity_days: number | null
  valid_until: string | null
  items: Array<{
    description: string
    quantity: number
    unit: string | null
    unit_price_cents: number
  }>
}

export interface QuoteValidationResult {
  ok: boolean
  error?: string
  itemErrors: Record<string, string>
  payload?: QuotePayload
  subtotalCents: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emptyItem(key: string): QuoteItemValues {
  return { key, description: '', quantity: '1', unit: 'un', unitPriceCents: 0 }
}

export function lineTotalCents(item: QuoteItemValues): number {
  const quantity = parseQuantity(item.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  return Math.round(quantity * item.unitPriceCents)
}

export function itemsSubtotalCents(items: QuoteItemValues[]): number {
  return items.reduce((total, item) => total + lineTotalCents(item), 0)
}

/**
 * Valida no cliente para dar feedback, mas o banco revalida e recalcula tudo.
 * Item inválido é reportado individualmente — nunca descartado em silêncio.
 */
export function validateQuoteForm(values: QuoteFormValues): QuoteValidationResult {
  const itemErrors: Record<string, string> = {}
  const payloadItems: QuotePayload['items'] = []

  if (!values.customerName.trim()) {
    return { ok: false, error: 'Informe o nome do cliente ou razão social.', itemErrors, subtotalCents: 0 }
  }

  if (values.customerEmail.trim() && !EMAIL_RE.test(values.customerEmail.trim())) {
    return { ok: false, error: 'E-mail do cliente inválido.', itemErrors, subtotalCents: 0 }
  }

  values.items.forEach((item) => {
    const quantity = parseQuantity(item.quantity)
    const description = item.description.trim()

    if (!description) {
      itemErrors[item.key] = 'Informe a descrição.'
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      itemErrors[item.key] = 'Quantidade deve ser maior que zero.'
      return
    }
    if (quantity > 999999) {
      itemErrors[item.key] = 'Quantidade acima do limite.'
      return
    }
    if (!Number.isFinite(item.unitPriceCents) || item.unitPriceCents < 0) {
      itemErrors[item.key] = 'Valor unitário inválido.'
      return
    }

    payloadItems.push({
      description,
      quantity,
      unit: item.unit.trim() || null,
      unit_price_cents: Math.round(item.unitPriceCents),
    })
  })

  if (payloadItems.length !== values.items.length) {
    const invalidCount = values.items.length - payloadItems.length
    return {
      ok: false,
      error: `${invalidCount} item(ns) com dados inválidos. Corrija os campos destacados.`,
      itemErrors,
      subtotalCents: itemsSubtotalCents(values.items),
    }
  }

  if (payloadItems.length === 0) {
    return { ok: false, error: 'Adicione pelo menos um item.', itemErrors, subtotalCents: 0 }
  }

  let validityDays: number | null = null
  if (values.validityDays.trim()) {
    const parsed = Number.parseInt(values.validityDays, 10)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
      return { ok: false, error: 'Validade deve ficar entre 1 e 365 dias.', itemErrors, subtotalCents: 0 }
    }
    validityDays = parsed
  }

  return {
    ok: true,
    itemErrors,
    subtotalCents: itemsSubtotalCents(values.items),
    payload: {
      customer_name: values.customerName.trim(),
      customer_phone: values.customerPhone.trim() || null,
      customer_email: values.customerEmail.trim().toLowerCase() || null,
      customer_tax_id: values.customerTaxId.trim() || null,
      notes: values.notes.trim() || null,
      payment_terms: values.paymentTerms.trim() || null,
      discount_cents: Math.max(0, Math.round(values.discountCents) || 0),
      validity_days: validityDays,
      valid_until: null,
      items: payloadItems,
    },
  }
}
