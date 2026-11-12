'use client'

import React, { useState } from 'react'
import { cn, formatCurrency, parseCurrencyToCents } from '@/lib/utils'

interface CurrencyInputProps {
  /** valor em centavos */
  value: number
  onChange: (cents: number) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
  required?: boolean
}

/**
 * Entrada monetária controlada por texto, não por máscara destrutiva.
 * - Enquanto o campo está em edição (`draft` não nulo), o texto digitado manda:
 *   backspace e separador decimal funcionam ("1,5" => R$ 1,50).
 * - Fora da edição, o texto exibido vem sempre das props (sem useEffect de
 *   sincronização, para não disparar setState dentro de um efeito).
 * - Caracteres que não são dígito, vírgula ou ponto são descartados.
 */
export function CurrencyInput({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'R$ 0,00',
  id,
  required = false,
}: CurrencyInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? formatCurrency(Number(value) || 0)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^\d.,]/g, '')
    setDraft(raw)
    onChange(parseCurrencyToCents(raw))
  }

  return (
    <input
      type="text"
      id={id}
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onFocus={() => setDraft(formatCurrency(Number(value) || 0))}
      onBlur={() => setDraft(null)}
      disabled={disabled}
      placeholder={placeholder}
      required={required}
      className={cn(
        'h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50',
        className
      )}
    />
  )
}
