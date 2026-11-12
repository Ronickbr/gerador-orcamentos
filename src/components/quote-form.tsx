'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  Percent,
  Phone,
  Plus,
  Printer,
  Save,
  Send,
  Trash2,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { CurrencyInput } from '@/components/currency-input'
import { cn, formatCurrency, parseQuantity } from '@/lib/utils'
import {
  emptyItem,
  itemsSubtotalCents,
  lineTotalCents,
  validateQuoteForm,
  type QuoteFormValues,
  type QuoteItemValues,
} from '@/lib/validation'
import { cancelQuote, issueQuote, saveQuoteDraft } from '@/app/(authenticated)/orcamentos/actions'
import type { Organization, Profile, QuoteStatus, UserRole } from '@/types/database'

export interface QuoteFormInitial {
  id: string
  version: number
  quoteNumber: string | null
  status: QuoteStatus
  values: QuoteFormValues
}

interface QuoteFormProps {
  mode: 'create' | 'edit'
  profile: Profile
  organization: Organization
  initial?: QuoteFormInitial
}

const COMMON_UNITS = ['un', 'cx', 'kg', 'm', 'm²', 'm³', 'h', 'serv', 'pct', 'kit', 'diária']

const PAYMENT_PRESETS = [
  'À vista via PIX com 5% de desconto',
  '50% entrada + 50% na entrega',
  'Faturado no Boleto para 30 dias',
  'Cartão de Crédito em até 10x',
]

function createId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Administrador', seller: 'Vendedor' }

export function QuoteForm({ mode, profile, organization, initial }: QuoteFormProps) {
  const router = useRouter()
  const [quoteId] = useState(() => initial?.id ?? createId())
  const [version, setVersion] = useState<number | null>(initial?.version ?? null)
  const requestIdRef = useRef<string | null>(null)

  const [values, setValues] = useState<QuoteFormValues>(() => {
    if (initial) return initial.values
    return {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerTaxId: '',
      paymentTerms: '',
      notes: '',
      validityDays: organization.default_validity_days
        ? String(organization.default_validity_days)
        : '',
      discountCents: 0,
      items: [emptyItem(createId())],
    }
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const [showIssueConfirm, setShowIssueConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [discountMode, setDiscountMode] = useState<'currency' | 'percent'>('currency')
  const [discountPercent, setDiscountPercent] = useState<string>(() => {
    if (initial && initial.values.discountCents > 0) {
      const sub = itemsSubtotalCents(initial.values.items)
      if (sub > 0) {
        const pct = (initial.values.discountCents / sub) * 100
        return Number(pct.toFixed(2)).toString().replace('.', ',')
      }
    }
    return ''
  })

  useEffect(() => {
    if (!showIssueConfirm && !showCancelConfirm) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowIssueConfirm(false)
        setShowCancelConfirm(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showIssueConfirm, showCancelConfirm])

  const subtotalCents = useMemo(() => itemsSubtotalCents(values.items), [values.items])

  const effectiveDiscountCents = useMemo(() => {
    if (discountMode === 'percent') {
      if (!discountPercent) return 0
      const numeric = parseFloat(discountPercent.replace(',', '.')) || 0
      const clamped = Math.min(Math.max(numeric, 0), 100)
      return Math.round((subtotalCents * clamped) / 100)
    }
    return values.discountCents
  }, [discountMode, discountPercent, subtotalCents, values.discountCents])

  const totalCents = Math.max(subtotalCents - effectiveDiscountCents, 0)

  const calculatedValidity = useMemo(() => {
    const days = Number.parseInt(values.validityDays, 10)
    if (!Number.isFinite(days) || days <= 0) return null
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toLocaleDateString('pt-BR')
  }, [values.validityDays])

  const handleDiscountModeChange = (mode: 'currency' | 'percent') => {
    if (mode === discountMode) return
    setDiscountMode(mode)

    if (mode === 'percent') {
      if (subtotalCents > 0 && values.discountCents > 0) {
        const pct = (values.discountCents / subtotalCents) * 100
        setDiscountPercent(Number(pct.toFixed(2)).toString().replace('.', ','))
      } else {
        setDiscountPercent('')
      }
    } else {
      patch({ discountCents: effectiveDiscountCents })
    }
  }

  const handlePercentInput = (rawText: string) => {
    const sanitized = rawText.replace(/[^\d.,]/g, '')
    const normalized = sanitized.replace(/\./g, ',')
    const parts = normalized.split(',')
    const cleanValue = parts.length > 2 ? `${parts[0]},${parts.slice(1).join('')}` : normalized
    setDiscountPercent(cleanValue)
  }

  const handleCurrencyDiscountChange = (cents: number) => {
    const capped = subtotalCents > 0 ? Math.min(cents, subtotalCents) : cents
    patch({ discountCents: capped })
  }

  const patch = (partial: Partial<QuoteFormValues>) =>
    setValues((current) => ({ ...current, ...partial }))

  const patchItem = (key: string, partial: Partial<QuoteItemValues>) =>
    setValues((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...partial } : item)),
    }))

  const addItem = () =>
    setValues((current) => ({ ...current, items: [...current.items, emptyItem(createId())] }))

  const removeItem = (key: string) =>
    setValues((current) => {
      if (current.items.length === 1) return current
      return { ...current, items: current.items.filter((item) => item.key !== key) }
    })

  const moveItem = (index: number, direction: -1 | 1) =>
    setValues((current) => {
      const target = index + direction
      if (target < 0 || target >= current.items.length) return current
      const items = [...current.items]
      const [moved] = items.splice(index, 1)
      items.splice(target, 0, moved)
      return { ...current, items }
    })

  const handleSubmit = async (shouldIssue: boolean) => {
    if (submitting) return
    setErrorMsg(null)

    const validation = validateQuoteForm({
      ...values,
      discountCents: effectiveDiscountCents,
    })
    setItemErrors(validation.itemErrors)
    if (!validation.ok || !validation.payload) {
      setErrorMsg(validation.error ?? 'Revise os dados do orçamento.')
      return
    }

    setSubmitting(true)
    const requestId = requestIdRef.current ?? createId()
    requestIdRef.current = requestId
    let navigating = false

    try {
      const saved = await saveQuoteDraft({
        quoteId,
        expectedVersion: version,
        requestId,
        payload: validation.payload,
      })

      if (!saved.ok) {
        setErrorMsg(saved.error)
        return
      }

      setVersion(saved.data.version)
      // O save já foi confirmado: o próximo clique é uma nova intenção, mesmo que
      // a emissão abaixo falhe. Evita reenvio idempotente com conteúdo editado.
      requestIdRef.current = null

      if (!shouldIssue) {
        navigating = true
        router.push(`/orcamentos/${quoteId}`)
        router.refresh()
        return
      }

      const issued = await issueQuote(quoteId, saved.data.version)
      if (!issued.ok) {
        setErrorMsg(
          `Rascunho salvo (v${saved.data.version}), mas a emissão falhou: ${issued.error}`
        )
        return
      }

      requestIdRef.current = null
      navigating = true
      router.push(`/orcamentos/${quoteId}/imprimir`)
      router.refresh()
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Falha de comunicação ao salvar: ${err.message}`
          : 'Falha de comunicação ao salvar. Verifique a conexão e tente novamente.'
      )
    } finally {
      // Em sucesso a navegação assume; só libera o botão em erro para permitir nova tentativa.
      if (!navigating) setSubmitting(false)
    }
  }

  const handleCancelQuote = async () => {
    if (!initial?.id || cancelling) return
    setCancelling(true)
    setErrorMsg(null)

    const result = await cancelQuote(initial.id, cancelReason)
    setCancelling(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      setShowCancelConfirm(false)
      return
    }

    setShowCancelConfirm(false)
    router.push(`/orcamentos/${initial.id}`)
    router.refresh()
  }

  const isCancelled = initial?.status === 'cancelled'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={mode === 'edit' ? `/orcamentos/${quoteId}` : '/orcamentos'}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 shadow-xs hover:bg-slate-50 transition-colors"
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'edit' ? 'Editar Orçamento' : 'Novo Orçamento'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'edit'
                ? `Rascunho ${initial?.quoteNumber ?? ''} • versão ${initial?.version ?? 1}`
                : 'Proposta comercial com cálculo validado no servidor.'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total:</span>
          <span className="text-lg font-bold font-mono text-slate-900">{formatCurrency(totalCents)}</span>
        </div>
      </div>

      {isCancelled && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>Orçamento cancelado não pode ser editado.</div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm text-red-800"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Vendedor responsável
              </span>
              <span className="text-base font-semibold text-slate-900">{profile.full_name}</span>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Phone className="h-3 w-3 text-slate-400" />
                <span>{profile.phone || 'Telefone não configurado no perfil'}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {ROLE_LABEL[profile.role]} • {organization.display_name}
              </div>
            </div>
          </div>

          {!profile.phone && (
            <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Sem telefone, o documento sai sem contato direto.</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">1</div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Identificação do Cliente
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="quote-customer-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nome do Cliente / Razão Social <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="quote-customer-name"
                type="text"
                required
                autoComplete="organization"
                value={values.customerName}
                onChange={(event) => patch({ customerName: event.target.value })}
                placeholder="Ex: João da Silva ou Padaria Central Ltda"
                className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="quote-customer-tax-id" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              CPF ou CNPJ (opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <FileText className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="quote-customer-tax-id"
                type="text"
                value={values.customerTaxId}
                onChange={(event) => patch({ customerTaxId: event.target.value })}
                placeholder="000.000.000-00"
                className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="quote-customer-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Telefone / WhatsApp (opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Phone className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="quote-customer-phone"
                type="tel"
                value={values.customerPhone}
                onChange={(event) => patch({ customerPhone: event.target.value })}
                placeholder="(41) 99999-9999"
                className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="quote-customer-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              E-mail de Contato (opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="quote-customer-email"
                type="email"
                value={values.customerEmail}
                onChange={(event) => patch({ customerEmail: event.target.value })}
                placeholder="cliente@empresa.com.br"
                className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">2</div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Produtos e Serviços
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {values.items.length} {values.items.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="space-y-3">
          {values.items.map((item, index) => {
            const itemError = itemErrors[item.key]
            return (
              <div key={item.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Item #{index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={`Mover item ${index + 1} para cima`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === values.items.length - 1}
                      className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={`Mover item ${index + 1} para baixo`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      disabled={values.items.length === 1}
                      className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label htmlFor={`item-description-${item.key}`} className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Descrição do Produto ou Serviço
                    </label>
                    <input
                      id={`item-description-${item.key}`}
                      type="text"
                      value={item.description}
                      onChange={(event) => patchItem(item.key, { description: event.target.value })}
                      aria-invalid={Boolean(itemError)}
                      aria-describedby={itemError ? `item-error-${item.key}` : undefined}
                      placeholder="Ex: Forno turbo elétrico 5 esteiras"
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                        itemError
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600'
                          : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`item-quantity-${item.key}`} className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Qtd
                    </label>
                    <input
                      id={`item-quantity-${item.key}`}
                      type="text"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) => patchItem(item.key, { quantity: event.target.value })}
                      aria-invalid={Boolean(itemError)}
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                        itemError
                          ? 'border-red-400 focus:border-red-600 focus:ring-red-600'
                          : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`item-unit-${item.key}`} className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Unidade
                    </label>
                    <input
                      id={`item-unit-${item.key}`}
                      type="text"
                      list="quote-common-units"
                      value={item.unit}
                      onChange={(event) => patchItem(item.key, { unit: event.target.value })}
                      placeholder="un"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`item-price-${item.key}`} className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Valor Unitário
                    </label>
                    <CurrencyInput
                      id={`item-price-${item.key}`}
                      value={item.unitPriceCents}
                      onChange={(cents) => patchItem(item.key, { unitPriceCents: cents })}
                      className="rounded-lg"
                    />
                  </div>
                </div>

                {itemError && (
                  <p id={`item-error-${item.key}`} className="text-xs text-red-600 font-medium">
                    {itemError}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-400">
                    {Number.isFinite(parseQuantity(item.quantity))
                      ? `${item.quantity} ${item.unit || 'un'} × ${formatCurrency(item.unitPriceCents)}`
                      : 'Quantidade inválida'}
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatCurrency(lineTotalCents(item))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <datalist id="quote-common-units">
          {COMMON_UNITS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={addItem}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 py-2.5 px-4 text-sm font-semibold text-blue-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Adicionar Outro Item</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">3</div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Condições Comerciais e Prazos
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="quote-validity" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Validade da Proposta (dias corridos)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="quote-validity"
                type="number"
                min="1"
                max="365"
                value={values.validityDays}
                onChange={(event) => patch({ validityDays: event.target.value })}
                placeholder={organization.default_validity_days ? `Padrão: ${organization.default_validity_days}` : 'Ex: 15'}
                className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            {calculatedValidity ? (
              <p className="text-xs text-blue-600 font-medium mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Válida até <strong>{calculatedValidity}</strong>
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Em branco = usa a validade padrão da empresa na emissão.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={discountMode === 'currency' ? 'quote-discount' : 'quote-discount-percent'}
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Desconto (opcional)
              </label>

              {/* Seletor de Tipo de Desconto: Real ou % */}
              <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleDiscountModeChange('currency')}
                  className={cn(
                    'px-2.5 py-0.5 text-xs font-medium rounded-md transition-all',
                    discountMode === 'currency'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                  title="Definir desconto em valor fixo (Reais)"
                >
                  R$ (Real)
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscountModeChange('percent')}
                  className={cn(
                    'px-2.5 py-0.5 text-xs font-medium rounded-md transition-all',
                    discountMode === 'percent'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                  title="Definir desconto em porcentagem (%)"
                >
                  % (Porcentagem)
                </button>
              </div>
            </div>

            {discountMode === 'currency' ? (
              <div>
                <CurrencyInput
                  id="quote-discount"
                  value={values.discountCents}
                  onChange={handleCurrencyDiscountChange}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                {effectiveDiscountCents > 0 && subtotalCents > 0 ? (
                  <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      Equivalente a{' '}
                      <strong>
                        {((effectiveDiscountCents / subtotalCents) * 100).toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </strong>{' '}
                      de desconto
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Valor fixo em dinheiro (ex: 80,00).
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Percent className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="quote-discount-percent"
                    type="text"
                    inputMode="decimal"
                    value={discountPercent}
                    onChange={(event) => handlePercentInput(event.target.value)}
                    placeholder="Ex: 12"
                    className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 font-medium"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                    %
                  </div>
                </div>
                {effectiveDiscountCents > 0 ? (
                  <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      Desconto aplicado:{' '}
                      <strong>− {formatCurrency(effectiveDiscountCents)}</strong>
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Porcentagem sobre o subtotal (ex: 12%).
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="quote-payment-terms" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Formas e Condições de Pagamento
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <CreditCard className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="quote-payment-terms"
                type="text"
                value={values.paymentTerms}
                onChange={(event) => patch({ paymentTerms: event.target.value })}
                placeholder="Ex: 50% de entrada + saldo em 30 dias"
                className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 self-center mr-1">Sugestões:</span>
              {PAYMENT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => patch({ paymentTerms: preset })}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="quote-notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Observações Gerais / Termos Adicionais (opcional)
            </label>
            <textarea
              id="quote-notes"
              rows={3}
              value={values.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Frete, prazos de entrega, garantia ou detalhes técnicos..."
              className="w-full rounded-xl border border-slate-300/80 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Valor Total do Orçamento
          </span>
          <div className="text-3xl font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(totalCents)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Subtotal {formatCurrency(subtotalCents)}
            {effectiveDiscountCents > 0 ? ` • Desconto ${formatCurrency(effectiveDiscountCents)}` : ''}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {mode === 'edit' && !isCancelled && (
            <button
              type="button"
              disabled={submitting || cancelling}
              onClick={() => setShowCancelConfirm(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-xs hover:bg-red-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Cancelar Proposta</span>
            </button>
          )}

          <button
            type="button"
            disabled={submitting || cancelling || isCancelled}
            onClick={() => handleSubmit(false)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <Save className="h-4 w-4 text-slate-500" />
            <span>{submitting ? 'Salvando...' : mode === 'edit' ? 'Salvar Alterações' : 'Salvar Rascunho'}</span>
          </button>

          <button
            type="button"
            disabled={submitting || cancelling || isCancelled}
            onClick={() => setShowIssueConfirm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>Salvar e Emitir</span>
          </button>
        </div>
      </div>

      {showIssueConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-dialog-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shrink-0">
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <h3 id="issue-dialog-title" className="text-lg font-bold text-slate-900">
                  Emitir Orçamento Oficial
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: <strong>{values.customerName || 'Não informado'}</strong>
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
              <p>
                A emissão reserva a numeração oficial, congela os dados do vendedor e bloqueia a
                edição do documento.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
                <div className="flex justify-between font-semibold">
                  <span>Valor Total:</span>
                  <span className="font-mono text-slate-900">{formatCurrency(totalCents)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowIssueConfirm(false)}
                disabled={submitting}
                autoFocus
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar e Revisar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowIssueConfirm(false)
                  void handleSubmit(true)
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Emitindo...' : 'Confirmar e Imprimir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-form-dialog-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="cancel-form-dialog-title" className="text-lg font-bold text-slate-900">
                  Cancelar Orçamento
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {initial?.quoteNumber || 'Orçamento em Rascunho'} — {values.customerName || 'Cliente'}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Orçamentos não podem ser excluídos. Ao confirmar o cancelamento, este documento permanecerá registrado e arquivado no banco de dados com status <strong>Cancelado</strong> para integridade e histórico.
            </p>

            <div>
              <label
                htmlFor="cancel-form-reason"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Motivo do cancelamento (opcional)
              </label>
              <textarea
                id="cancel-form-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex: cliente desistiu / cotação descontinuada"
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelQuote}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
