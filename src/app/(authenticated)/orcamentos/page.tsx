'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  FileText,
  Eye,
  Pencil,
  Printer,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Clock,
  DollarSign,
  ArrowUpRight,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, quoteStatusLabel } from '@/lib/utils'
import {
  cancelQuote,
  loadQuoteMetrics,
  loadMonthlyEvolution,
  type MonthlyDataPoint,
} from '@/app/(authenticated)/orcamentos/actions'
import { DashboardChart } from '@/components/dashboard-chart'
import type { Profile, QuoteListRow, QuoteMetrics, QuoteStatus } from '@/types/database'
import type { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 15

let quoteListViewAvailable = false

function isMissingViewError(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /quote_list/i.test(error.message ?? '')
}

const STATUS_FILTERS: Array<{ id: 'all' | QuoteStatus; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'issued', label: 'Emitidos' },
  { id: 'draft', label: 'Rascunhos' },
  { id: 'expired', label: 'Expirados' },
  { id: 'cancelled', label: 'Cancelados' },
]

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  issued: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  expired: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
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
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([])
  const [teamMembers, setTeamMembers] = useState<Profile[]>([])
  const [sellerFilter, setSellerFilter] = useState<string | null>(null)

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

  // Debounce de busca
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

  // 1. Carregamento das métricas e evolução mensal real
  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const [metricsResult, monthlyResult] = await Promise.all([
          loadQuoteMetrics(),
          loadMonthlyEvolution(),
        ])
        if (!active) return
        if (metricsResult.ok) {
          setMetrics(metricsResult.data)
        }
        if (monthlyResult.ok) {
          setMonthlyData(monthlyResult.data)
        }
      } catch {
        // Falhas não bloqueiam a tabela
      }
    })()

    return () => {
      active = false
    }
  }, [refreshToken])

  // 2. Carregamento da lista
  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        let currentProfile = profile

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

        // Carrega equipe real da organização
        if (currentProfile) {
          const { data: teamData } = await supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', currentProfile.organization_id)
            .order('full_name', { ascending: true })

          if (!controller.signal.aborted && teamData) {
            setTeamMembers(teamData as Profile[])
          }
        }

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

          if (sellerFilter) {
            viewQuery = viewQuery.eq('seller_user_id', sellerFilter)
          }

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

        if (quoteListViewAvailable && isMissingViewError(error)) {
          quoteListViewAvailable = false
        }

        if (!quoteListViewAvailable) {
          let fallbackQuery = supabase
            .from('quotes')
            .select(
              `
              *,
              seller:profiles!quotes_seller_user_id_fkey(full_name, phone)
            `,
              { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

          if (sellerFilter) {
            fallbackQuery = fallbackQuery.eq('seller_user_id', sellerFilter)
          }

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
  }, [page, search, statusFilter, sellerFilter, refreshToken, supabase, router, profile])

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

  // Cálculos dinâmicos baseados 100% em dados reais
  const averageTicketCents = useMemo(() => {
    if (!metrics || metrics.total_count === 0) return 0
    return Math.round(metrics.active_volume_cents / Math.max(1, metrics.total_count))
  }, [metrics])

  const conversionRate = useMemo(() => {
    if (!metrics || metrics.total_count === 0) return 0
    return Math.round((metrics.issued_count / metrics.total_count) * 100)
  }, [metrics])

  const draftVolumeCents = useMemo(() => {
    if (metrics?.draft_volume_cents !== undefined) return metrics.draft_volume_cents
    if (!metrics || metrics.total_count === 0) return 0
    return Math.round(metrics.active_volume_cents * (metrics.draft_count / metrics.total_count))
  }, [metrics])

  const issuedVolumeCents = useMemo(() => {
    if (metrics?.issued_volume_cents !== undefined) return metrics.issued_volume_cents
    return metrics?.active_volume_cents ?? 0
  }, [metrics])

  return (
    <div className="space-y-8 select-none">
      {/* =========================================================================
          1. TOP NOTIFICATION / ERROR
          ========================================================================= */}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-red-950/60 p-4 border border-red-800/80 text-sm text-red-200 backdrop-blur-sm"
        >
          {errorMsg}
        </div>
      )}

      {/* =========================================================================
          2. TOP KPI CARDS (NextUI 3-Card Header - 100% Funcionais)
          ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Resumo de Vendas
          </h1>
          <span className="text-xs text-zinc-400">
            {profile?.role === 'admin' ? 'Visão Geral da Organização' : 'Minhas Propostas Ativas'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Vibrant Solid Blue Card (Total Emitido) */}
          <button
            type="button"
            onClick={() => handleStatusChange(statusFilter === 'issued' ? 'all' : 'issued')}
            className={`group text-left relative overflow-hidden rounded-2xl bg-[#0072f5] p-6 text-white shadow-xl shadow-blue-600/25 transition-all hover:-translate-y-1 cursor-pointer ${
              statusFilter === 'issued' ? 'ring-4 ring-white/70' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-md">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold tracking-wide text-white/90">
                  Total Emitido
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md">
                {metrics && metrics.total_count > 0
                  ? `${Math.round((metrics.issued_count / metrics.total_count) * 100)}% do total`
                  : '0%'}
              </span>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight font-mono">
                {formatCurrency(issuedVolumeCents)}
              </div>
              <p className="text-xs text-white/80 mt-1">
                {metrics?.issued_count ?? 0} {metrics?.issued_count === 1 ? 'proposta emitida' : 'propostas emitidas'}
              </p>
            </div>

            {/* Sub-metrics footer */}
            <div className="mt-5 pt-4 border-t border-white/20 flex items-center justify-between text-[11px] text-white/85 font-mono">
              <div className="flex items-center gap-1">
                <span className="text-white/60">Total:</span>
                <span>{metrics?.total_count ?? 0} propostas</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/60">Filtrar:</span>
                <span className="font-bold underline text-white">
                  {statusFilter === 'issued' ? 'Ativo ✓' : 'Ver emitidos →'}
                </span>
              </div>
            </div>
          </button>

          {/* Card 2: Sleek Dark Card (Rascunhos & Negociação) */}
          <button
            type="button"
            onClick={() => handleStatusChange(statusFilter === 'draft' ? 'all' : 'draft')}
            className={`group text-left relative overflow-hidden rounded-2xl bg-[#18181b] border border-zinc-800 p-6 text-white shadow-xl transition-all hover:-translate-y-1 cursor-pointer ${
              statusFilter === 'draft' ? 'ring-4 ring-[#0072f5]/60 border-[#0072f5]' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold tracking-wide text-zinc-300">
                  Rascunhos & Negociação
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                {metrics && metrics.total_count > 0
                  ? `${Math.round((metrics.draft_count / metrics.total_count) * 100)}% pendentes`
                  : '0%'}
              </span>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight font-mono text-zinc-100">
                {formatCurrency(draftVolumeCents)}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {metrics?.draft_count ?? 0} {metrics?.draft_count === 1 ? 'rascunho em aberto' : 'rascunhos em aberto'}
              </p>
            </div>

            {/* Sub-metrics footer */}
            <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">Expirados:</span>
                <span className="text-amber-400 font-semibold">{metrics?.expired_count ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">Filtrar:</span>
                <span className="font-bold underline text-zinc-200">
                  {statusFilter === 'draft' ? 'Ativo ✓' : 'Ver rascunhos →'}
                </span>
              </div>
            </div>
          </button>

          {/* Card 3: Vibrant Solid Green Card (Ticket Médio & Eficiência) */}
          <button
            type="button"
            onClick={() => handleStatusChange('all')}
            className={`group text-left relative overflow-hidden rounded-2xl bg-[#17c964] p-6 text-white shadow-xl shadow-emerald-600/25 transition-all hover:-translate-y-1 cursor-pointer ${
              statusFilter === 'all' && !sellerFilter ? 'ring-4 ring-white/70' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-md">
                  <DollarSign className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold tracking-wide text-white/90">
                  Ticket Médio
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md">
                {conversionRate}% conv.
              </span>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight font-mono">
                {formatCurrency(averageTicketCents)}
              </div>
              <p className="text-xs text-white/80 mt-1">Média por proposta ativa</p>
            </div>

            {/* Sub-metrics footer */}
            <div className="mt-5 pt-4 border-t border-white/20 flex items-center justify-between text-[11px] text-white/85 font-mono">
              <div className="flex items-center gap-1">
                <span className="text-white/60">Conversão:</span>
                <span>{conversionRate}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/60">Total:</span>
                <span className="font-bold text-white">{metrics?.total_count ?? totalCount} docs</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN SECTION: 2-COLUMN LAYOUT (Evolução + Tabela + Cards Laterais)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Statistics Chart + Full Data Table */}
        <div className="lg:col-span-8 space-y-6">
          {/* Dual Glowing Bezier Curve Area Chart com Dados Reais */}
          <DashboardChart
            data={monthlyData}
            title="Evolução Comercial"
            subtitle="Histórico mensal real de propostas emitidas e rascunhos em negociação"
          />

          {/* Data Table Container with Filters */}
          <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="search"
                  placeholder="Filtrar nesta lista..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#0072f5] focus:outline-none focus:ring-1 focus:ring-[#0072f5]"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills (NextUI Pill style) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {STATUS_FILTERS.map((tab) => {
                  const active = statusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleStatusChange(tab.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#0072f5] text-white shadow-md shadow-blue-600/30'
                          : 'bg-zinc-800/70 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active Seller Filter Banner */}
            {sellerFilter && (
              <div className="flex items-center justify-between rounded-xl bg-blue-950/40 border border-blue-800/60 px-3.5 py-2 text-xs text-blue-200">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#0072f5]" />
                  <span>
                    Filtrando por vendedor:{' '}
                    <strong>
                      {teamMembers.find((m) => m.id === sellerFilter)?.full_name || 'Vendedor selecionado'}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSellerFilter(null)}
                  className="text-xs font-semibold text-blue-300 hover:text-white underline cursor-pointer"
                >
                  Remover filtro
                </button>
              </div>
            )}

            {/* Table or Empty State */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-14">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0072f5] border-t-transparent" />
                <span className="mt-3 text-xs font-medium text-zinc-400">
                  Carregando propostas...
                </span>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-zinc-800 rounded-xl">
                <FileText className="mx-auto h-8 w-8 text-zinc-600" />
                <h3 className="mt-3 text-sm font-semibold text-zinc-200">
                  Nenhum orçamento encontrado
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {search || statusFilter !== 'all'
                    ? 'Ajuste os filtros ou o termo de busca.'
                    : 'Comece cadastrando a primeira proposta.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121215] text-[10px] uppercase font-bold tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th scope="col" className="py-3 px-4">Número</th>
                      <th scope="col" className="py-3 px-4">Cliente</th>
                      <th scope="col" className="py-3 px-4">Data</th>
                      {profile?.role === 'admin' && (
                        <th scope="col" className="py-3 px-4">Vendedor</th>
                      )}
                      <th scope="col" className="py-3 px-4 text-right">Valor</th>
                      <th scope="col" className="py-3 px-4 text-center">Status</th>
                      <th scope="col" className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {rows.map((quote) => (
                      <tr key={quote.id} className="hover:bg-zinc-800/40 transition-colors group">
                        <td className="py-3 px-4">
                          <Link
                            href={`/orcamentos/${quote.id}`}
                            className="font-mono font-bold text-[#0072f5] hover:text-blue-400 inline-flex items-center gap-1"
                          >
                            <span>{quote.quote_number || 'Rascunho'}</span>
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-200">
                          <div>{quote.customer_name}</div>
                          {quote.customer_phone && (
                            <div className="text-[10px] text-zinc-500">{quote.customer_phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                          {formatDate(quote.created_at)}
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="py-3 px-4 text-zinc-400 text-[11px]">
                            {quote.seller_name || 'Vendedor'}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-100 whitespace-nowrap">
                          {formatCurrency(quote.total_cents)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <StatusBadge status={quote.status} />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {quote.status === 'issued' && (
                              <Link
                                href={`/orcamentos/${quote.id}/imprimir`}
                                title="Imprimir em papel timbrado"
                                className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            {quote.status === 'draft' && (
                              <Link
                                href={`/orcamentos/${quote.id}/editar`}
                                title="Editar rascunho"
                                className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            <Link
                              href={`/orcamentos/${quote.id}`}
                              title="Visualizar proposta"
                              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            {quote.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => setCancellingQuote(quote)}
                                title="Cancelar orçamento"
                                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
                <span>
                  Página {page} de {totalPages} • {totalCount} registro(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true)
                      setPage((c) => Math.max(1, c - 1))
                    }}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-[#121215] text-xs font-medium text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true)
                      setPage((c) => Math.min(totalPages, c + 1))
                    }}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-[#121215] text-xs font-medium text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Equipe Comercial + Transações Recentes */}
        <div className="lg:col-span-4 space-y-6">
          {/* Section: Agents (Equipe Comercial Real e Funcional) */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#18181b] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Equipe
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                ★ {teamMembers.length} {teamMembers.length === 1 ? 'Membro' : 'Membros'}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Vendedores & Acessos</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {teamMembers.length > 0
                  ? 'Clique em um vendedor para filtrar seus orçamentos no painel.'
                  : 'Nenhum membro adicional cadastrado na organização.'}
              </p>
            </div>

            {/* Overlapping Real Avatar Stack */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <div className="flex -space-x-2.5 overflow-hidden py-1">
                {teamMembers.slice(0, 6).map((member) => {
                  const isSelected = sellerFilter === member.id
                  const initials = member.full_name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSellerFilter(isSelected ? null : member.id)
                        setPage(1)
                      }}
                      title={`${member.full_name} (${member.role === 'admin' ? 'Admin' : 'Vendedor'}) — Clique para filtrar`}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 ring-2 ring-[#18181b] text-white font-bold text-[10px] transition-transform hover:scale-110 cursor-pointer ${
                        isSelected ? 'ring-4 ring-[#0072f5] scale-110 z-10' : ''
                      }`}
                    >
                      {initials}
                    </button>
                  )
                })}
              </div>

              {teamMembers.length > 6 && (
                <span className="text-xs font-bold text-zinc-400">
                  +{teamMembers.length - 6}
                </span>
              )}

              {sellerFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSellerFilter(null)
                    setPage(1)
                  }}
                  className="text-[11px] font-semibold text-rose-400 hover:underline cursor-pointer ml-auto"
                >
                  Limpar filtro
                </button>
              )}
            </div>

            {/* Seller Quick List com Filtro em 1 Clique */}
            {teamMembers.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                {teamMembers.slice(0, 4).map((member) => {
                  const isSelected = sellerFilter === member.id
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSellerFilter(isSelected ? null : member.id)
                        setPage(1)
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-[#0072f5]/20 border border-[#0072f5]/40 text-white'
                          : 'hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-semibold block truncate text-zinc-100">
                          {member.full_name}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          {member.role === 'admin' ? 'Administrador' : 'Vendedor'} • {member.email}
                        </span>
                      </div>
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          member.active ? 'bg-[#17c964]' : 'bg-zinc-600'
                        }`}
                        title={member.active ? 'Ativo' : 'Inativo'}
                      />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Quick Link to Team */}
            {profile?.role === 'admin' && (
              <div className="pt-2">
                <Link
                  href="/admin/vendedores"
                  className="block text-center w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Gerenciar Equipe Completa →
                </Link>
              </div>
            )}
          </div>

          {/* Section: Latest Transactions (Transações Recentes Reais) */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#18181b] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Transações Recentes</h3>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                Últimos orçamentos
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {rows.slice(0, 5).map((quote) => (
                <Link
                  key={quote.id}
                  href={`/orcamentos/${quote.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors group border border-transparent hover:border-zinc-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 p-[1.5px]">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#18181b] text-white text-[10px] font-bold">
                        {quote.customer_name ? quote.customer_name.substring(0, 2).toUpperCase() : 'OR'}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-zinc-200 block truncate group-hover:text-blue-400 transition-colors">
                        {quote.customer_name}
                      </span>
                      <span className="text-[10px] text-zinc-500 block truncate font-mono">
                        {quote.quote_number || 'Rascunho'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-[#17c964] font-mono block">
                      {formatCurrency(quote.total_cents)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block">
                      {formatDate(quote.created_at)}
                    </span>
                  </div>
                </Link>
              ))}

              {rows.length === 0 && (
                <div className="text-center py-6 px-3 border border-dashed border-zinc-800 rounded-xl space-y-2">
                  <p className="text-xs text-zinc-500">
                    Nenhuma transação recente no momento.
                  </p>
                  <Link
                    href="/orcamentos/novo"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0072f5] text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                  >
                    + Novo Orçamento
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. CANCEL QUOTE MODAL (Dark Glassmorphic Dialog)
          ========================================================================= */}
      {cancellingQuote && (
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
                <p className="text-xs text-zinc-400">
                  {cancellingQuote.quote_number || 'Rascunho'} — {cancellingQuote.customer_name}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Orçamentos não são excluídos. Ao confirmar, este orçamento permanecerá arquivado no
              banco com status <strong className="text-rose-400">Cancelado</strong> para histórico.
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
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex: cliente declinou proposta..."
                rows={3}
                className="w-full rounded-xl border border-zinc-800 bg-[#121215] p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
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
                className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
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
