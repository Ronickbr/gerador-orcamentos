import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Quote, QuoteStatus } from "@/types/database"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrency(cents: number): string {
  return BRL.format((Number(cents) || 0) / 100)
}

/**
 * Converte texto monetário pt-BR/en-US para centavos.
 * Aceita "1.234,56", "1,234.56", "1234.56", "12,5", "R$ 1.234,56".
 * A regra é: o último separador (, ou .) é o decimal; o outro é milhar.
 */
export function parseCurrencyToCents(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) : 0
  }

  const raw = value.trim()
  if (!raw) return 0

  const negative = raw.includes('-')
  const digits = raw.replace(/[^\d,.]/g, '')
  if (!digits) return 0

  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  let normalized: string

  if (lastComma >= 0 && lastComma > lastDot) {
    normalized = digits.replace(/\./g, '').replace(/,/g, '.')
  } else if (lastDot >= 0) {
    const decimals = digits.length - lastDot - 1
    // 3 dígitos após o ponto = separador de milhar (1.234).
    normalized = decimals === 3 ? digits.replace(/\./g, '') : digits.replace(/,/g, '')
  } else {
    normalized = digits
  }

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return 0
  return Math.round((negative ? -parsed : parsed) * 100)
}

/** Quantidade aceita decimais com vírgula ou ponto; inválida vira NaN. */
export function parseQuantity(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const raw = value.trim()
  if (!raw) return NaN
  const normalized = raw.replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

/** Exibe 1.5 como "1,5" e 2 como "2". */
export function formatQuantity(quantity: number | string): string {
  const parsed = parseQuantity(quantity)
  if (!Number.isFinite(parsed)) return String(quantity)
  return parsed.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/** status "expired" é derivado, nunca gravado. */
export function deriveQuoteStatus(quote: Pick<Quote, 'status' | 'valid_until'>): QuoteStatus {
  if (quote.status === 'issued' && quote.valid_until) {
    const validUntil = new Date(quote.valid_until).getTime()
    if (Number.isFinite(validUntil) && validUntil < Date.now()) return 'expired'
  }
  return quote.status
}

export function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'draft':
      return 'Rascunho'
    case 'issued':
      return 'Emitido'
    case 'cancelled':
      return 'Cancelado'
    case 'expired':
      return 'Expirado'
  }
}
