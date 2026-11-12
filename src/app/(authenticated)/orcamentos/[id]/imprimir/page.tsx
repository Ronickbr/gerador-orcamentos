'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Organization, Quote } from '@/types/database'
import { QuotePrintableDoc } from '@/components/quote-printable-doc'

export default function PrintQuotePage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params.id as string
  const supabase = createClient()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('quotes')
        .select('*, items:quote_items(*), seller:profiles!quotes_seller_user_id_fkey(full_name, phone, email)')
        .eq('id', quoteId)
        .single()

      if (controller.signal.aborted) return

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

      if (controller.signal.aborted) return

      if (!org) {
        setErrorMsg('Organização não encontrada. Documento não pode ser gerado sem os dados institucionais.')
        setLoading(false)
        return
      }

      setOrganization(org as Organization)
      setLoading(false)
    })()

    return () => controller.abort()
  }, [quoteId, router, supabase])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
        <span className="mt-3 text-sm text-slate-500">Preparando documento...</span>
      </div>
    )
  }

  if (errorMsg || !quote || !organization) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          {errorMsg ?? 'Não foi possível montar o documento.'}
        </div>
        <Link href={`/orcamentos/${quoteId}`} className="text-sm font-semibold text-blue-700 hover:underline">
          Voltar ao orçamento
        </Link>
      </div>
    )
  }

  return <QuotePrintableDoc quote={quote} organization={organization} />
}
