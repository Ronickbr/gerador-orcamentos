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
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Lock,
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
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  issued: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadQuote é estável por render e o efeito depende do id da rota
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
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="mt-4 text-sm font-medium text-slate-500">Carregando orçamento...</span>
      </div>
    )
  }

  if (errorMsg && !quote) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          {errorMsg}
        </div>
        <Link href="/orcamentos" className="text-sm font-semibold text-blue-700 hover:underline">
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
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/orcamentos"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 shadow-xs hover:bg-slate-50 transition-colors"
            title="Voltar à lista"
            aria-label="Voltar à lista"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono">
                {quote.quote_number || 'Orçamento em Rascunho'}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${STATUS_STYLES[status]}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {quoteStatusLabel(status)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Criado em {formatDate(quote.created_at)}
              {quote.issued_at && ` • Emitido em ${formatDate(quote.issued_at)}`}
              {quote.valid_until && ` • Válido até ${formatDate(quote.valid_until)}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyInternalLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            title="Copia o link interno. Quem abrir precisa estar logado."
          >
            {copiedLink ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4 text-slate-400" />
            )}
            <span>{copiedLink ? 'Link interno copiado' : 'Copiar link interno'}</span>
          </button>

          <Link
            href={`/orcamentos/${quote.id}/imprimir`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir / PDF</span>
          </Link>

          {isDraft && (
            <>
              <Link
                href={`/orcamentos/${quote.id}/editar`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-sm font-semibold text-amber-700 shadow-xs hover:bg-amber-50 active:scale-95 transition-all"
              >
                <Pencil className="h-4 w-4 text-amber-600" />
                <span>Editar</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowIssueModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Emitir Oficialmente</span>
              </button>
            </>
          )}

          {!isCancelled && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 shadow-xs hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancelar Proposta</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {isExpired && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200/80 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-bold block">Validade expirada</span>
            <p className="mt-0.5 text-xs">
              A proposta passou da data de validade. Emita um novo orçamento ou combine nova
              validade com o cliente.
            </p>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="bg-red-50 rounded-2xl border border-red-200/80 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <span className="font-bold block text-red-900">Orçamento cancelado</span>
            <p className="mt-0.5 text-xs text-red-700">
              {quote.cancel_reason
                ? `Motivo registrado: "${quote.cancel_reason}"`
                : 'Nenhum motivo informado no cancelamento.'}
              {quote.cancelled_at && ` • ${formatDate(quote.cancelled_at)}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Dados do Cliente
            </span>
            {rawCustomerPhone && (
              <a
                href={`https://wa.me/55${rawCustomerPhone}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">{quote.customer_name}</h2>
            {quote.customer_tax_id && (
              <div className="text-xs font-mono text-slate-500 mt-0.5">CPF/CNPJ: {quote.customer_tax_id}</div>
            )}
          </div>

          <div className="space-y-1.5 pt-1 text-xs text-slate-600">
            {quote.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{quote.customer_phone}</span>
              </div>
            )}
            {quote.customer_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <a href={`mailto:${quote.customer_email}`} className="text-blue-600 hover:underline">
                  {quote.customer_email}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Emissor da Proposta
            </span>
            <span className="text-xs font-semibold text-blue-600">
              {organization?.display_name ?? '—'}
            </span>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">{sellerName ?? 'Não registrado'}</h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {isDraft ? 'Vendedor responsável' : 'Vendedor congelado na emissão'}
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-xs text-slate-600">
            {sellerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{sellerPhone}</span>
              </div>
            )}
            {quote.valid_until && (
              <div className="flex items-center gap-2 text-blue-700 font-medium">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>Validade: até {formatDate(quote.valid_until)}</span>
              </div>
            )}
            {!sellerName && !sellerPhone && (
              <div className="flex items-center gap-2 text-slate-400">
                <Lock className="h-3.5 w-3.5" />
                <span>Snapshot indisponível; documento sem contato direto.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Composição do Orçamento
          </h2>
          <span className="text-xs text-slate-400">
            {quote.items?.length ?? 0} {(quote.items?.length ?? 0) === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th scope="col" className="py-3 px-5 text-center w-12">#</th>
                <th scope="col" className="py-3 px-5">Descrição</th>
                <th scope="col" className="py-3 px-5 text-center">Qtd</th>
                <th scope="col" className="py-3 px-5 text-center">Un</th>
                <th scope="col" className="py-3 px-5 text-right">Valor Unitário</th>
                <th scope="col" className="py-3 px-5 text-right">Total Linha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(quote.items ?? []).length > 0 ? (
                [...(quote.items ?? [])]
                  .sort((a, b) => a.position - b.position)
                  .map((item, index) => (
                    <tr key={item.id ?? index} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 text-center text-xs font-bold text-slate-400">
                        {item.position || index + 1}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-900">{item.description}</td>
                      <td className="py-3.5 px-5 text-center text-slate-700 font-mono text-xs">
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="py-3.5 px-5 text-center text-slate-500 text-xs">{item.unit || 'un'}</td>
                      <td className="py-3.5 px-5 text-right font-mono text-xs text-slate-600">
                        {formatCurrency(item.unit_price_cents)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatCurrency(item.line_total_cents)}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Nenhum item adicionado a este orçamento.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t border-slate-200">
              {quote.discount_cents > 0 && (
                <tr>
                  <td colSpan={5} className="py-2 px-5 text-right text-xs text-slate-600">
                    Subtotal:
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-xs text-slate-700">
                    {formatCurrency(quote.subtotal_cents)}
                  </td>
                </tr>
              )}
              {quote.discount_cents > 0 && (
                <tr>
                  <td colSpan={5} className="py-2 px-5 text-right text-xs text-emerald-700">
                    Desconto:
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-xs text-emerald-700">
                    − {formatCurrency(quote.discount_cents)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={5} className="py-4 px-5 text-right font-bold text-slate-700 text-sm uppercase tracking-wider">
                  Valor Total Geral:
                </td>
                <td className="py-4 px-5 text-right font-mono font-bold text-blue-700 text-lg sm:text-xl">
                  {formatCurrency(quote.total_cents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
          Condições Comerciais e Informações Adicionais
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Condições de Pagamento
            </span>
            <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              {quote.payment_terms || 'Não especificadas no orçamento.'}
            </p>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Observações Gerais & Prazos
            </span>
            <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60 whitespace-pre-wrap">
              {quote.notes || 'Nenhuma observação adicional incluída.'}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          A versão para impressão é interna: o link exige login e não expõe a proposta publicamente.
        </p>
      </div>

      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-dialog-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shrink-0">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <h3 id="issue-dialog-title" className="text-lg font-bold text-slate-900">
                  Emitir Orçamento Oficial
                </h3>
                <p className="text-xs text-slate-500">{quote.customer_name}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              A emissão reserva a numeração oficial e bloqueia a edição direta. Repetir a ação
              devolve o mesmo número, sem duplicar.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                disabled={actionLoading}
                autoFocus
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? 'Emitindo...' : 'Confirmar e Imprimir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="cancel-dialog-title" className="text-lg font-bold text-slate-900">
                  Cancelar Orçamento
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {quote.quote_number || 'Orçamento em Rascunho'} — {quote.customer_name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Orçamentos não podem ser excluídos. Ao confirmar o cancelamento, este documento permanecerá registrado e arquivado no banco de dados com status <strong>Cancelado</strong> para integridade e histórico.
            </p>

            <div>
              <label htmlFor="cancel-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Motivo do cancelamento (opcional)
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex: proposta recusada / erro na precificação"
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                autoFocus
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
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
