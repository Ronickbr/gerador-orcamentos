'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  FileText,
  Eye,
  Pencil,
  Printer,
  XCircle,
  Calendar,
  AlertTriangle,
  FileCheck2,
  Clock,
  DollarSign,
  PlusCircle,
  ArrowUpRight,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, quoteStatusLabel } from '@/lib/utils'
import { cancelQuote, loadQuoteMetrics } from '@/app/(authenticated)/orcamentos/actions'
import type { Profile, QuoteListRow, QuoteMetrics, QuoteStatus } from '@/types/database'
import type { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 20

/**
 * A view `quote_list` só existe depois da migration de endurecimento ser aplicada.
 * Como padrão, consultamos diretamente `quotes` com join em `profiles`, garantindo
 * carregamento instantâneo sem erros de schema cache.
 */
let quoteListViewAvailable = false

function isMissingViewError(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /quote_list/i.test(error.message ?? '')
}

const STATUS_FILTERS: Array<{ id: 'all' | QuoteStatus; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'draft', label: 'Rascunhos' },
  { id: 'issued', label: 'Emitidos' },
  { id: 'expired', label: 'Expirados' },
  { id: 'cancelled', label: 'Cancelados' },
]

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  issued: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {quoteStatusLabel(status)}
    </span>
  )
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Erro ao carregar orçamentos.'
}

export default function QuotesListPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<QuoteListRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [metrics, setMetrics] = useState<QuoteMetrics | null>(null)

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all')
  const [page, setPage] = useState(1)
  const [refreshToken, setRefreshToken] = useState(0)

  const [cancellingQuote, setCancellingQuote] = useState<QuoteListRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const isFirstRender = useRef(true)

  // Debounce de busca: evita execução no mount inicial quando vazio
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // ==============================================================================
  // 1. CARREGAMENTO DESACOPLADO DAS MÉTRICAS
  // Disparado no mount inicial e APENAS quando refreshToken mudar (mutações).
  // NÃO dispara em troca de página (page), busca ou filtros de status.
  // ==============================================================================
  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const metricsResult = await loadQuoteMetrics()
        if (!active) return
        if (metricsResult.ok) {
          setMetrics(metricsResult.data)
        }
      } catch {
        // Falhas não bloqueiam a visualização da tabela
      }
    })()

    return () => {
      active = false
    }
  }, [refreshToken])

  // ==============================================================================
  // 2. CARREGAMENTO DA LISTA DE ORÇAMENTOS
  // Roda em paralelo com as métricas no mount. Reutiliza o perfil já carregado
  // para evitar chamadas redundantes a getUser() e profiles em paginação/filtros.
  // ==============================================================================
  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        let currentProfile = profile

        // Carrega o perfil apenas se ainda não existir no estado
        if (!currentProfile) {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            if (!controller.signal.aborted) router.replace('/login')
            return
          }

          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (controller.signal.aborted) return
          currentProfile = (userProfile as Profile) ?? null
          setProfile(currentProfile)
        }

        // No banco o status é 'issued' + valid_until vencido; 'expired' é derivado.
        const nowIso = new Date().toISOString()
        const term = search ? search.replace(/[,%()]/g, ' ').trim() : ''

        let data: QuoteListRow[] | null = null
        let count: number | null = null
        let error: PostgrestError | null = null

        if (quoteListViewAvailable) {
          let viewQuery = supabase
            .from('quote_list')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

          if (statusFilter === 'expired') {
            viewQuery = viewQuery.eq('status', 'issued').lt('valid_until', nowIso)
          } else if (statusFilter !== 'all') {
            viewQuery = viewQuery.eq('status', statusFilter)
          }

          if (term) {
            viewQuery = viewQuery.or(
              `customer_name.ilike.%${term}%,quote_number.ilike.%${term}%,seller_name.ilike.%${term}%`
            )
          }

          const viewRes = await viewQuery
          data = viewRes.data as QuoteListRow[] | null
          count = viewRes.count
          error = viewRes.error
        }

        // View ausente (migration pendente): cai para `quotes` e não tenta de novo
        // nesta sessão, para não repetir o 404 no console a cada carregamento.
        if (quoteListViewAvailable && isMissingViewError(error)) {
          quoteListViewAvailable = false
        }

        if (!quoteListViewAvailable) {
          let fallbackQuery = supabase
            .from('quotes')
            .select(`
              *,
              seller:profiles!quotes_seller_user_id_fkey(full_name, phone)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

          if (statusFilter === 'expired') {
            fallbackQuery = fallbackQuery.eq('status', 'issued').lt('valid_until', nowIso)
          } else if (statusFilter !== 'all') {
            fallbackQuery = fallbackQuery.eq('status', statusFilter)
          }

          if (term) {
            fallbackQuery = fallbackQuery.or(
              `customer_name.ilike.%${term}%,quote_number.ilike.%${term}%`
            )
          }

          const fallbackRes = await fallbackQuery
          if (!fallbackRes.error) {
            const now = new Date()
            const mapped = (fallbackRes.data ?? []).map((q: Record<string, unknown>) => {
              const storedStatus = q.status as QuoteStatus
              const validUntil = q.valid_until as string | null
              const isExpired =
                storedStatus === 'issued' && Boolean(validUntil) && new Date(validUntil as string) < now
              return {
                ...q,
                status: isExpired ? 'expired' : storedStatus,
                stored_status: storedStatus,
                seller_name:
                  (q.seller_name_snapshot as string | null) ||
                  ((q.seller as { full_name?: string } | null)?.full_name ?? 'Vendedor'),
              }
            })
            data = mapped as unknown as QuoteListRow[]
            count = fallbackRes.count
            error = null
          } else {
            error = fallbackRes.error
          }
        }

        if (controller.signal.aborted) return

        if (error) {
          setErrorMsg(error.message)
        } else {
          setRows(data ?? [])
          setTotalCount(count ?? 0)
          setErrorMsg(null)
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setErrorMsg(getErrorMessage(err))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    })()

    return () => controller.abort()
  }, [page, search, statusFilter, refreshToken, supabase, router, profile])

  const handleStatusChange = (next: 'all' | QuoteStatus) => {
    setLoading(true)
    setPage(1)
    setStatusFilter(next)
  }

  const handleCancel = async () => {
    if (!cancellingQuote) return
    setActionLoading(true)

    const result = await cancelQuote(cancellingQuote.id, cancelReason)
    setActionLoading(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setCancellingQuote(null)
    setCancelReason('')
    setLoading(true)
    setRefreshToken((token) => token + 1)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {profile?.role === 'admin' ? 'Painel Geral de Orçamentos' : 'Meus Orçamentos'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Consulte, gerencie propostas e emita documentos em papel timbrado.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="hidden sm:inline-flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs self-start sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span>{totalCount} {totalCount === 1 ? 'proposta registrada' : 'propostas registradas'}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{metrics?.total_count ?? '—'}</div>
          <p className="text-xs text-slate-400 mt-1">Propostas visíveis para você</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Emitidos</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">{metrics?.issued_count ?? '—'}</div>
          <p className="text-xs text-slate-400 mt-1">
            {metrics ? `${metrics.expired_count} expirado(s)` : 'Aguardando métricas'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rascunhos</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-700">{metrics?.draft_count ?? '—'}</div>
          <p className="text-xs text-slate-400 mt-1">Em elaboração</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Volume ativo</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {metrics ? formatCurrency(metrics.active_volume_cents) : '—'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Rascunhos + emitidos, sem cancelados</p>
        </div>
      </div>

      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="quote-search" className="sr-only">
            Buscar orçamentos
          </label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="quote-search"
            type="search"
            placeholder="Buscar por cliente, vendedor ou número..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded-xl border border-slate-300/80 py-2 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" role="group" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((tab) => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusChange(tab.id)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <span className="mt-4 text-sm font-medium text-slate-500">Carregando propostas...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-dashed border-slate-300 p-12 sm:p-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Nenhum orçamento encontrado</h2>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {search || statusFilter !== 'all'
              ? 'Nenhuma proposta corresponde aos filtros de busca atuais.'
              : 'Comece criando a primeira proposta comercial da sua empresa.'}
          </p>
          {search || statusFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setStatusFilter('all')
                setPage(1)
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Limpar filtros de busca</span>
            </button>
          ) : (
            <Link
              href="/orcamentos/novo"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Criar Primeiro Orçamento</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th scope="col" className="py-3.5 px-5">Número</th>
                  <th scope="col" className="py-3.5 px-5">Cliente</th>
                  <th scope="col" className="py-3.5 px-5">Data</th>
                  {profile?.role === 'admin' && <th scope="col" className="py-3.5 px-5">Vendedor</th>}
                  <th scope="col" className="py-3.5 px-5 text-right">Valor Total</th>
                  <th scope="col" className="py-3.5 px-5 text-center">Status</th>
                  <th scope="col" className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((quote) => (
                  <tr key={quote.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="py-4 px-5">
                      <Link
                        href={`/orcamentos/${quote.id}`}
                        className="font-mono font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1.5"
                      >
                        <span>{quote.quote_number || 'Rascunho'}</span>
                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="py-4 px-5 font-medium text-slate-900">
                      <div>{quote.customer_name}</div>
                      {quote.customer_phone && (
                        <div className="text-xs text-slate-400 mt-0.5">{quote.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDate(quote.created_at)}</span>
                      </div>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="py-4 px-5 text-slate-700 text-xs font-medium">
                        {quote.seller_name || 'Vendedor'}
                      </td>
                    )}
                    <td className="py-4 px-5 text-right font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                      {formatCurrency(quote.total_cents)}
                    </td>
                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {quote.status === 'issued' && (
                          <Link
                            href={`/orcamentos/${quote.id}/imprimir`}
                            title="Imprimir em papel timbrado (requer login)"
                            aria-label={`Imprimir orçamento ${quote.quote_number ?? ''}`}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Printer className="h-4 w-4" />
                          </Link>
                        )}
                        {quote.status === 'draft' && (
                          <Link
                            href={`/orcamentos/${quote.id}/editar`}
                            title="Editar rascunho"
                            aria-label={`Editar orçamento ${quote.quote_number ?? 'rascunho'}`}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        )}
                        <Link
                          href={`/orcamentos/${quote.id}`}
                          title="Visualizar proposta"
                          aria-label={`Visualizar orçamento ${quote.quote_number ?? 'rascunho'}`}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {quote.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCancellingQuote(quote)}
                            title="Cancelar orçamento (mantém no banco)"
                            aria-label={`Cancelar orçamento ${quote.quote_number ?? ''}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-100">
            {rows.map((quote) => (
              <div key={quote.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    {quote.quote_number || 'Rascunho'}
                  </span>
                  <StatusBadge status={quote.status} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{quote.customer_name}</div>
                  {quote.customer_phone && (
                    <div className="text-xs text-slate-500">{quote.customer_phone}</div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 text-xs text-slate-500 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDate(quote.created_at)}</span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-base">
                    {formatCurrency(quote.total_cents)}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  {quote.status === 'issued' && (
                    <Link
                      href={`/orcamentos/${quote.id}/imprimir`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir
                    </Link>
                  )}
                  {quote.status === 'draft' && (
                    <Link
                      href={`/orcamentos/${quote.id}/editar`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Link>
                  )}
                  <Link
                    href={`/orcamentos/${quote.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver
                  </Link>
                  {quote.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => setCancellingQuote(quote)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Página {page} de {totalPages} • {totalCount} registro(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  setPage((current) => Math.max(1, current - 1))
                }}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  setPage((current) => Math.min(totalPages, current + 1))
                }}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {cancellingQuote && (
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
                <p className="text-xs text-slate-500">
                  {cancellingQuote.quote_number || 'Rascunho'} — {cancellingQuote.customer_name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Orçamentos não podem ser excluídos. Ao confirmar, este orçamento permanecerá arquivado no banco de dados com status <strong>Cancelado</strong> para histórico e controle da empresa.
            </p>

            <div>
              <label htmlFor="cancel-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Motivo do cancelamento (opcional)
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex: cliente desistiu / erro na cotação"
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingQuote(null)
                  setCancelReason('')
                }}
                disabled={actionLoading}
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
