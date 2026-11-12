'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QuoteForm, type QuoteFormInitial } from '@/components/quote-form'
import { formatQuantity } from '@/lib/utils'
import type { Organization, Profile, Quote } from '@/types/database'

function daysUntil(dateString: string | null): string {
  if (!dateString) return ''
  const diff = new Date(dateString).getTime() - Date.now()
  if (!Number.isFinite(diff)) return ''
  return String(Math.max(1, Math.ceil(diff / 86_400_000)))
}

export default function EditQuotePage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [initial, setInitial] = useState<QuoteFormInitial | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (controller.signal.aborted) return

      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: userProfile }, { data: quote, error: quoteError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('quotes')
          .select('*, items:quote_items(*)')
          .eq('id', quoteId)
          .single(),
      ])

      if (controller.signal.aborted) return

      if (!userProfile || !userProfile.active) {
        setErrorMsg('Perfil inexistente ou inativo.')
        setLoading(false)
        return
      }

      if (quoteError || !quote) {
        setErrorMsg('Orçamento não encontrado ou sem permissão de acesso.')
        setLoading(false)
        return
      }

      const typedQuote = quote as Quote

      if (typedQuote.status !== 'draft') {
        setErrorMsg('Orçamentos emitidos ou cancelados são imutáveis. Este documento não pode ser editado.')
        setLoading(false)
        return
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', typedQuote.organization_id)
        .single()

      if (controller.signal.aborted) return

      if (!org) {
        setErrorMsg('Organização não encontrada.')
        setLoading(false)
        return
      }

      const items = [...(typedQuote.items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          key: item.id ?? `${typedQuote.id}-${item.position}`,
          description: item.description,
          quantity: formatQuantity(item.quantity),
          unit: item.unit ?? 'un',
          unitPriceCents: item.unit_price_cents,
        }))

      setProfile(userProfile as Profile)
      setOrganization(org as Organization)
      setInitial({
        id: typedQuote.id,
        version: typedQuote.version,
        quoteNumber: typedQuote.quote_number,
        status: typedQuote.status,
        values: {
          customerName: typedQuote.customer_name,
          customerPhone: typedQuote.customer_phone ?? '',
          customerEmail: typedQuote.customer_email ?? '',
          customerTaxId: typedQuote.customer_tax_id ?? '',
          paymentTerms: typedQuote.payment_terms ?? '',
          notes: typedQuote.notes ?? '',
          validityDays: daysUntil(typedQuote.valid_until),
          discountCents: typedQuote.discount_cents,
          items:
            items.length > 0
              ? items
              : [
                  {
                    key: `${typedQuote.id}-empty`,
                    description: '',
                    quantity: '1',
                    unit: 'un',
                    unitPriceCents: 0,
                  },
                ],
        },
      })
      setLoading(false)
    })()

    return () => controller.abort()
  }, [quoteId, router, supabase])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="mt-4 text-sm font-medium text-slate-500">Carregando dados da proposta...</span>
      </div>
    )
  }

  if (errorMsg || !profile || !organization || !initial) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          {errorMsg ?? 'Não foi possível carregar o orçamento.'}
        </div>
        <button
          type="button"
          onClick={() => router.push(`/orcamentos/${quoteId}`)}
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          Voltar ao orçamento
        </button>
      </div>
    )
  }

  return (
    <QuoteForm
      mode="edit"
      profile={profile}
      organization={organization}
      initial={initial}
    />
  )
}

