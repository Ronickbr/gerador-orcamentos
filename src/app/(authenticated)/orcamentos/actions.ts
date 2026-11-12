'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { validateQuoteForm } from '@/lib/validation'
import { logPerf } from '@/lib/perf'
import type {
  ActionResult,
  CancelQuoteResult,
  CreateSellerInput,
  IssueQuoteResult,
  SaveQuoteInput,
  SaveQuoteResult,
  SellerInput,
  UpdateProfileInput,
} from '@/types/actions'
import type { Organization, Profile, QuoteMetrics } from '@/types/database'

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await getAuthenticatedUser()
  return { supabase, user }
}

// ==============================================================================
// Cache em memória para métricas de orçamentos (por organização e usuário)
// TTL curto (15 segundos) para evitar recálculos frequentes e múltiplos POSTs.
// Invalida imediatamente quando qualquer orçamento é salvo, emitido ou cancelado.
// ==============================================================================

interface MetricsCacheEntry {
  data: QuoteMetrics
  expiresAt: number
}

const metricsMemoryCache = new Map<string, MetricsCacheEntry>()
const METRICS_CACHE_TTL_MS = 15_000

// Flag de detecção da RPC quote_metrics para não repetir 404 em bancos sem a migration
let quoteMetricsRpcAvailable: boolean | null = null

export async function clearQuoteMetricsCache(): Promise<void> {
  metricsMemoryCache.clear()
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Erro inesperado.'
}

export async function saveQuoteDraft(input: SaveQuoteInput): Promise<ActionResult<SaveQuoteResult>> {
  const start = performance.now()
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const validation = validateQuoteForm({
    customerName: input.payload.customer_name,
    customerPhone: input.payload.customer_phone ?? '',
    customerEmail: input.payload.customer_email ?? '',
    customerTaxId: input.payload.customer_tax_id ?? '',
    paymentTerms: input.payload.payment_terms ?? '',
    notes: input.payload.notes ?? '',
    validityDays: input.payload.validity_days ? String(input.payload.validity_days) : '',
    discountCents: input.payload.discount_cents,
    items: input.payload.items.map((item, index) => ({
      key: String(index),
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit ?? '',
      unitPriceCents: item.unit_price_cents,
    })),
  })
  if (!validation.ok || !validation.payload) {
    return fail(validation.error ?? 'Dados do orçamento inválidos.')
  }

  const { data, error } = await supabase.rpc('save_quote_draft', {
    p_quote_id: input.quoteId,
    p_expected_version: input.expectedVersion,
    p_quote: validation.payload,
    p_items: validation.payload.items,
    p_request_id: input.requestId,
  })

  if (error) return fail(error.message)
  if (!data) return fail('Não foi possível salvar o orçamento.')

  const saved = data as SaveQuoteResult
  // Invalida cache de métricas em mutação
  metricsMemoryCache.clear()

  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${saved.quote_id}`)
  logPerf('saveQuoteDraft', performance.now() - start, { quoteId: saved.quote_id })
  return { ok: true, data: saved }
}

export async function issueQuote(
  quoteId: string,
  expectedVersion: number | null
): Promise<ActionResult<IssueQuoteResult>> {
  const start = performance.now()
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const { data, error } = await supabase.rpc('issue_quote', {
    p_quote_id: quoteId,
    p_expected_version: expectedVersion,
  })

  if (error) return fail(error.message)
  if (!data) return fail('Não foi possível emitir o orçamento.')

  // Invalida cache de métricas em mutação
  metricsMemoryCache.clear()

  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${quoteId}`)
  revalidatePath(`/orcamentos/${quoteId}/imprimir`)
  logPerf('issueQuote', performance.now() - start, { quoteId })
  return { ok: true, data: data as IssueQuoteResult }
}

export async function cancelQuote(
  quoteId: string,
  reason: string
): Promise<ActionResult<CancelQuoteResult>> {
  const start = performance.now()
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const { data, error } = await supabase.rpc('cancel_quote', {
    p_quote_id: quoteId,
    p_reason: reason,
  })

  if (error) {
    // Se a RPC no banco remoto for a versão legada restrita a issued, executa fallback seguro
    if (/emitidos podem ser cancelados/i.test(error.message)) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('organization_id, role, active')
        .eq('id', user.id)
        .single()

      if (!myProfile || !myProfile.active) return fail('Usuário inativo ou sem perfil.')

      const { data: quote } = await supabase
        .from('quotes')
        .select('id, organization_id, seller_user_id, version, status')
        .eq('id', quoteId)
        .single()

      if (!quote || quote.organization_id !== myProfile.organization_id) {
        return fail('Orçamento não encontrado.')
      }

      if (myProfile.role !== 'admin' && quote.seller_user_id !== user.id) {
        return fail('Permissão negada para cancelar este orçamento.')
      }

      const cleanReason = reason?.trim() || null
      const nextVersion = (quote.version || 1) + 1

      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'cancelled',
          cancel_reason: cleanReason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          version: nextVersion,
        })
        .eq('id', quoteId)

      if (updateError) {
        return fail(updateError.message)
      }

      metricsMemoryCache.clear()
      revalidatePath('/orcamentos')
      revalidatePath(`/orcamentos/${quoteId}`)
      logPerf('cancelQuote (fallback)', performance.now() - start, { quoteId })
      return { ok: true, data: { success: true, status: 'cancelled', version: nextVersion } }
    }
    return fail(error.message)
  }

  if (!data) return fail('Não foi possível cancelar o orçamento.')

  // Invalida cache de métricas em mutação
  metricsMemoryCache.clear()

  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${quoteId}`)
  logPerf('cancelQuote', performance.now() - start, { quoteId })
  return { ok: true, data: data as CancelQuoteResult }
}

export async function updateMyProfile(
  input: UpdateProfileInput
): Promise<ActionResult<Profile>> {
  const start = performance.now()
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const fullName = input.fullName?.trim()
  if (!fullName || fullName.length < 2) {
    return fail('O nome deve conter ao menos 2 caracteres.')
  }

  const phone = input.phone?.trim() || null

  // 1. Se informou nova senha, valida e atualiza no Auth
  if (input.newPassword !== undefined && input.newPassword !== '') {
    if (input.newPassword.length < 8) {
      return fail('A nova senha deve ter no mínimo 8 caracteres.')
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password: input.newPassword,
    })

    if (passwordError) {
      return fail(passwordError.message || 'Falha ao atualizar senha.')
    }
  }

  // 2. Atualiza metadados do auth
  await supabase.auth.updateUser({
    data: { full_name: fullName },
  })

  // 3. Tenta via RPC update_my_profile (se presente no banco)
  let updatedProfile: Profile | null = null
  const { data: rpcData, error: rpcError } = await supabase.rpc('update_my_profile', {
    p_full_name: fullName,
    p_phone: phone,
  })

  if (!rpcError && rpcData) {
    const res = rpcData as { success: boolean; profile: Profile }
    updatedProfile = res.profile
  } else {
    // Fallback: atualização direta na tabela profiles com a policy profiles_update_self
    const { data: directData, error: directError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single()

    if (directError) {
      return fail(directError.message || 'Falha ao atualizar perfil.')
    }
    updatedProfile = directData as Profile
  }

  if (!updatedProfile) {
    return fail('Não foi possível confirmar os dados atualizados.')
  }

  revalidatePath('/', 'layout')
  revalidatePath('/perfil')
  revalidatePath('/orcamentos')
  logPerf('updateMyProfile', performance.now() - start, { userId: user.id })
  return { ok: true, data: updatedProfile }
}

export async function updateOrganizationSettings(
  payload: Record<string, unknown>
): Promise<ActionResult<Organization>> {
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const { data, error } = await supabase.rpc('update_organization_settings', {
    p_payload: payload,
  })

  if (error) return fail(error.message)
  const result = data as { success: boolean; organization: Organization } | null
  if (!result?.organization) return fail('Não foi possível salvar as configurações.')

  revalidatePath('/admin/configuracoes')
  revalidatePath('/orcamentos')
  return { ok: true, data: result.organization }
}

export async function createSeller(input: CreateSellerInput): Promise<ActionResult<Profile>> {
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const { data: me } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single()

  if (!me || me.role !== 'admin' || !me.active) {
    return fail('Apenas administradores ativos podem cadastrar usuários.')
  }

  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!fullName || !email) return fail('Nome e e-mail são obrigatórios.')
  if (input.password.length < 8) return fail('A senha provisória deve ter ao menos 8 caracteres.')

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return fail(
      'Cadastro de usuário exige SUPABASE_SERVICE_ROLE_KEY configurada no servidor. ' +
        'A chave nunca é exposta ao navegador.'
    )
  }

  const service = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    return fail(createError?.message ?? 'Falha ao criar usuário no Auth.')
  }

  const { data, error } = await supabase.rpc('admin_provision_seller', {
    p_user_id: created.user.id,
    p_full_name: fullName,
    p_email: email,
    p_phone: input.phone,
    p_role: input.role,
  })

  if (error) {
    // Compensa: sem perfil válido, não deixa usuário órfão no Auth.
    await service.auth.admin.deleteUser(created.user.id)
    return fail(error.message)
  }

  const result = data as { profile: Profile } | null
  if (!result?.profile) return fail('Perfil não foi provisionado.')

  revalidatePath('/admin/vendedores')
  return { ok: true, data: result.profile }
}

export async function updateSeller(
  profileId: string,
  input: SellerInput
): Promise<ActionResult<Profile>> {
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  const { data, error } = await supabase.rpc('admin_update_profile', {
    p_profile_id: profileId,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_role: input.role,
    p_active: input.active,
  })

  if (error) return fail(error.message)
  const result = data as { profile: Profile } | null
  if (!result?.profile) return fail('Não foi possível atualizar o usuário.')

  revalidatePath('/admin/vendedores')
  return { ok: true, data: result.profile }
}

export async function loadQuoteMetrics(): Promise<ActionResult<QuoteMetrics>> {
  const start = performance.now()
  const { supabase, user } = await requireUser()
  if (!user) return fail('Sessão expirada. Entre novamente.')

  // Identifica perfil do usuário para cache isolado e filtros com RLS
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('organization_id, role, active')
    .eq('id', user.id)
    .single()

  if (!userProfile || !userProfile.active) {
    return fail('Usuário inativo ou sem perfil.')
  }

  // Chave de cache estritamente isolada por tenant e papel de acesso
  const cacheKey = `${userProfile.organization_id}:${userProfile.role === 'admin' ? 'admin' : user.id}`
  const nowMs = Date.now()
  const cached = metricsMemoryCache.get(cacheKey)

  if (cached && cached.expiresAt > nowMs) {
    const duration = performance.now() - start
    logPerf('loadQuoteMetrics', duration, { cache: 'HIT', org: userProfile.organization_id })
    return { ok: true, data: cached.data }
  }

  // 1. Tenta chamar a RPC quote_metrics (apenas se não confirmada ausente)
  if (quoteMetricsRpcAvailable !== false) {
    try {
      const { data, error } = await supabase.rpc('quote_metrics')
      if (!error && data) {
        quoteMetricsRpcAvailable = true
        const metricsData = data as QuoteMetrics
        metricsMemoryCache.set(cacheKey, { data: metricsData, expiresAt: nowMs + METRICS_CACHE_TTL_MS })
        const duration = performance.now() - start
        logPerf('loadQuoteMetrics', duration, { source: 'RPC', org: userProfile.organization_id })
        return { ok: true, data: metricsData }
      }

      if (error) {
        // Se a função não existe no banco, desativa tentativas para não gerar 404 repetidos
        if (
          error.code === 'PGRST202' ||
          error.code === '42883' ||
          /could not find the function|quote_metrics/i.test(error.message)
        ) {
          quoteMetricsRpcAvailable = false
        }
      }
    } catch {
      quoteMetricsRpcAvailable = false
    }
  }

  // 2. Fallback: calcula métricas diretamente via query otimizada e indexada
  try {
    let query = supabase
      .from('quotes')
      .select('status, total_cents, valid_until')
      .eq('organization_id', userProfile.organization_id)

    // Vendedores comuns só visualizam e computam métricas das suas próprias propostas
    if (userProfile.role !== 'admin') {
      query = query.eq('seller_user_id', user.id)
    }

    const { data: quotes, error: quotesError } = await query

    if (quotesError) return fail(quotesError.message)

    const now = new Date()
    const total_count = quotes?.length ?? 0
    let issued_count = 0
    let draft_count = 0
    let expired_count = 0
    let cancelled_count = 0
    let active_volume_cents = 0

    for (const q of quotes ?? []) {
      let st = q.status
      if (st === 'issued' && q.valid_until && new Date(q.valid_until) < now) {
        st = 'expired'
      }
      if (st === 'issued') issued_count++
      else if (st === 'draft') draft_count++
      else if (st === 'expired') expired_count++
      else if (st === 'cancelled') cancelled_count++

      if (st !== 'cancelled') {
        active_volume_cents += Number(q.total_cents) || 0
      }
    }

    const resultMetrics: QuoteMetrics = {
      total_count,
      issued_count,
      draft_count,
      expired_count,
      cancelled_count,
      active_volume_cents,
    }

    // Grava no cache
    metricsMemoryCache.set(cacheKey, { data: resultMetrics, expiresAt: nowMs + METRICS_CACHE_TTL_MS })
    const duration = performance.now() - start
    logPerf('loadQuoteMetrics', duration, { source: 'FALLBACK_QUERY', count: total_count })

    return {
      ok: true,
      data: resultMetrics,
    }
  } catch (err: unknown) {
    return fail(getErrorMessage(err) || 'Erro ao calcular métricas.')
  }
}
