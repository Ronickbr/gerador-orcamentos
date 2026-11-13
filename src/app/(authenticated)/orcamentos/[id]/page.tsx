'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Printer,
  Pencil,
  Send,
  XCircle,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Copy,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  deriveQuoteStatus,
  formatCurrency,
  formatDate,
  formatQuantity,
  quoteStatusLabel,
} from '@/lib/utils'
import { cancelQuote, issueQuote } from '@/app/(authenticated)/orcamentos/actions'
import type { Organization, Quote, QuoteStatus } from '@/types/database'

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  issued: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  expired: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params.id as string
  const supabase = createClient()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  const loadQuote = async (signal?: AbortSignal) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (signal?.aborted) return

    if (!user) {
      router.replace('/login')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('quotes')
      .select('*, items:quote_items(*), seller:profiles!quotes_seller_user_id_fkey(full_name, phone, email)')
      .eq('id', quoteId)
      .single()

    if (signal?.aborted) return

    if (error || !data) {
      setErrorMsg('Orçamento não encontrado ou sem permissão de acesso.')
      setLoading(false)
      return
    }

    const typedQuote = data as Quote
    setQuote(typedQuote)

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', typedQuote.organization_id)
      .single()

    if (signal?.aborted) return
    setOrganization((org as Organization) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      await loadQuote(controller.signal)
    })()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, router, supabase])

  useEffect(() => {
    if (!showIssueModal && !showCancelModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowIssueModal(false)
        setShowCancelModal(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showIssueModal, showCancelModal])

  const handleIssue = async () => {
    if (!quote) return
    setActionLoading(true)
    const result = await issueQuote(quote.id, quote.version)
    setActionLoading(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setShowIssueModal(false)
    router.push(`/orcamentos/${quote.id}/imprimir`)
    router.refresh()
  }

  const handleCancel = async () => {
    if (!quote) return
    setActionLoading(true)
    const result = await cancelQuote(quote.id, cancelReason)
    setActionLoading(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setShowCancelModal(false)
    setQuote((current) =>
      current
        ? {
            ...current,
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: cancelReason || null,
          }
        : current
    )
    router.refresh()
  }

  const handleCopyInternalLink = async () => {
    const url = `${window.location.origin}/orcamentos/${quoteId}/imprimir`
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard indisponível')
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      setErrorMsg('Não foi possível copiar o link. Copie manualmente: ' + url)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0072f5] border-t-transparent" />
        <span className="mt-4 text-xs font-medium text-zinc-400">Carregando orçamento...</span>
      </div>
    )
  }

  if (errorMsg && !quote) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-6 text-xs text-zinc-300">
          {errorMsg}
        </div>
        <Link href="/orcamentos" className="text-xs font-semibold text-[#0072f5] hover:underline">
          Voltar à lista
        </Link>
      </div>
    )
  }

  if (!quote) return null

  const status = deriveQuoteStatus(quote)
  const isDraft = status === 'draft'
  const isCancelled = status === 'cancelled'
  const isExpired = status === 'expired'

  const sellerName = quote.seller_name_snapshot || quote.seller?.full_name || null
  const sellerPhone = quote.seller_phone_snapshot || quote.seller?.phone || null
  const rawCustomerPhone = quote.customer_phone?.replace(/\D/g, '')

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/orcamentos"
            className="p-2 rounded-xl text-zinc-400 hover:text-white bg-[#18181b] border border-zinc-800 shadow-md hover:bg-zinc-800 transition-colors"
            title="Voltar à lista"
            aria-label="Voltar à lista"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {quote.quote_number || 'Orçamento em Rascunho'}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold border ${STATUS_STYLES[status]}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {quoteStatusLabel(status)}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Criado em {formatDate(quote.created_at)}
              {quote.issued_at && ` • Emitido em ${formatDate(quote.issued_at)}`}
              {quote.valid_until && ` • Válido até ${formatDate(quote.valid_until)}`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyInternalLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#18181b] px-3.5 py-2 text-xs font-semibold text-zinc-300 shadow-md hover:bg-zinc-800 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="Copia o link interno de impressão"
          >
            {copiedLink ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#17c964]" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span>{copiedLink ? 'Link copiado' : 'Copiar link'}</span>
          </button>

          <Link
            href={`/orcamentos/${quote.id}/imprimir`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0072f5] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-600 active:scale-95 transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir / PDF</span>
          </Link>

          {isDraft && (
            <>
              <Link
                href={`/orcamentos/${quote.id}/editar`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowIssueModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#17c964] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-600 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Emitir Oficialmente</span>
              </button>
            </>
          )}

          {!isCancelled && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-950/60 bg-rose-950/20 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 active:scale-95 transition-all cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancelar</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-red-950/60 p-4 border border-red-800/80 text-xs text-red-200 backdrop-blur-sm"
        >
          {errorMsg}
        </div>
      )}

      {isExpired && (
        <div className="bg-amber-950/50 rounded-2xl border border-amber-800/60 p-4 text-xs text-amber-200 flex items-start gap-3 backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold block text-amber-100">Validade expirada</span>
            <p className="mt-0.5 text-zinc-300">
              A proposta passou da data de validade. Emita um novo orçamento ou combine nova validade.
            </p>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="bg-rose-950/50 rounded-2xl border border-rose-800/60 p-4 text-xs text-rose-200 flex items-start gap-3 backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <span className="font-bold block text-rose-100">Orçamento cancelado</span>
            <p className="mt-0.5 text-zinc-300">
              {quote.cancel_reason
                ? `Motivo registrado: "${quote.cancel_reason}"`
                : 'Nenhum motivo informado no cancelamento.'}
              {quote.cancelled_at && ` • ${formatDate(quote.cancelled_at)}`}
            </p>
          </div>
        </div>
      )}

      {/* Customer & Seller Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Card */}
        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Dados do Cliente
            </span>
            {rawCustomerPhone && (
              <a
                href={`https://wa.me/55${rawCustomerPhone}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#17c964] hover:underline font-semibold"
              >
                <MessageSquare className="h-3 w-3" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>

          <div>
            <h2 className="text-base font-bold text-white">{quote.customer_name}</h2>
            {quote.customer_tax_id && (
              <div className="text-xs font-mono text-zinc-400 mt-0.5">
                CPF/CNPJ: {quote.customer_tax_id}
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1 text-xs text-zinc-300">
            {quote.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                <span>{quote.customer_phone}</span>
              </div>
            )}
            {quote.customer_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-zinc-500" />
                <a href={`mailto:${quote.customer_email}`} className="text-blue-400 hover:underline">
                  {quote.customer_email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Seller Card */}
        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Emissor da Proposta
            </span>
            <span className="text-xs font-semibold text-[#0072f5]">
              {organization?.display_name ?? '—'}
            </span>
          </div>

          <div>
            <h2 className="text-base font-bold text-white">{sellerName ?? 'Não registrado'}</h2>
            <div className="text-xs text-zinc-400 mt-0.5">
              {isDraft ? 'Vendedor responsável' : 'Vendedor vinculado à proposta'}
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-xs text-zinc-300">
            {sellerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                <span>{sellerPhone}</span>
              </div>
            )}
            {quote.valid_until && (
              <div className="flex items-center gap-2 text-blue-400 font-medium">
                <Clock className="h-3.5 w-3.5 text-[#0072f5]" />
                <span>Validade: até {formatDate(quote.valid_until)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table Card */}
      <div className="rounded-2xl border border-zinc-800 bg-[#18181b] shadow-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Composição do Orçamento
          </h2>
          <span className="text-xs text-zinc-500">
            {quote.items?.length ?? 0} {(quote.items?.length ?? 0) === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121215] text-[10px] uppercase font-bold tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th scope="col" className="py-3 px-4 text-center w-10">#</th>
                <th scope="col" className="py-3 px-4">Descrição</th>
                <th scope="col" className="py-3 px-4 text-center">Qtd</th>
                <th scope="col" className="py-3 px-4 text-center">Un</th>
                <th scope="col" className="py-3 px-4 text-right">Valor Unitário</th>
                <th scope="col" className="py-3 px-4 text-right">Total Linha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {(quote.items ?? []).length > 0 ? (
                [...(quote.items ?? [])]
                  .sort((a, b) => a.position - b.position)
                  .map((item, index) => (
                    <tr key={item.id ?? index} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 text-center text-xs font-bold text-zinc-500">
                        {item.position || index + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-100">{item.description}</td>
                      <td className="py-3 px-4 text-center text-zinc-300 font-mono">
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-400">{item.unit || 'un'}</td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400">
                        {formatCurrency(item.unit_price_cents)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-zinc-100">
                        {formatCurrency(item.line_total_cents)}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    Nenhum item adicionado a este orçamento.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-[#121215] border-t border-zinc-800">
              {quote.discount_cents > 0 && (
                <tr>
                  <td colSpan={5} className="py-2 px-4 text-right text-xs text-zinc-400">
                    Subtotal:
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-xs text-zinc-300">
                    {formatCurrency(quote.subtotal_cents)}
                  </td>
                </tr>
              )}
              {quote.discount_cents > 0 && (
                <tr>
                  <td colSpan={5} className="py-2 px-4 text-right text-xs text-[#17c964]">
                    Desconto:
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-xs text-[#17c964]">
                    − {formatCurrency(quote.discount_cents)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={5} className="py-3 px-4 text-right font-bold text-zinc-300 uppercase tracking-wider text-xs">
                  Valor Total Geral:
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-[#0072f5] text-base sm:text-lg">
                  {formatCurrency(quote.total_cents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Conditions and Notes Card */}
      <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-6 shadow-xl space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-800 pb-3">
          Condições Comerciais e Informações Adicionais
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Condições de Pagamento
            </span>
            <p className="text-xs text-zinc-200 leading-relaxed bg-[#121215] p-3 rounded-xl border border-zinc-800/80">
              {quote.payment_terms || 'Não especificadas no orçamento.'}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Observações Gerais & Prazos
            </span>
            <p className="text-xs text-zinc-200 leading-relaxed bg-[#121215] p-3 rounded-xl border border-zinc-800/80 whitespace-pre-wrap">
              {quote.notes || 'Nenhuma observação adicional incluída.'}
            </p>
          </div>
        </div>
      </div>

      {/* Modal Emitir */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-dialog-title"
            className="bg-[#18181b] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-[#0072f5] shrink-0">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 id="issue-dialog-title" className="text-base font-bold text-white">
                  Emitir Orçamento Oficial
                </h3>
                <p className="text-xs text-zinc-400">{quote.customer_name}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              A emissão reserva a numeração oficial e bloqueia a edição direta. O documento estará pronto para impressão e envio ao cliente.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0072f5] hover:bg-blue-600 rounded-xl shadow-md shadow-blue-600/25 transition-colors cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? 'Emitindo...' : 'Confirmar e Imprimir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            className="bg-[#18181b] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-950/60 border border-rose-800/50 text-rose-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="cancel-dialog-title" className="text-base font-bold text-white">
                  Cancelar Orçamento
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  {quote.quote_number || 'Orçamento em Rascunho'} — {quote.customer_name}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Orçamentos não são excluídos. Ao confirmar, o orçamento permanecerá registrado no banco com status <strong>Cancelado</strong> para histórico e controle.
            </p>

            <div>
              <label
                htmlFor="cancel-reason"
                className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Motivo do cancelamento (opcional)
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: cliente recusou proposta..."
                rows={3}
                className="w-full rounded-xl border border-zinc-800 bg-[#121215] p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-colors cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
