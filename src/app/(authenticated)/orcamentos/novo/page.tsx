'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QuoteForm } from '@/components/quote-form'
import type { Organization, Profile } from '@/types/database'

export default function NewQuotePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
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

      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (controller.signal.aborted) return

      if (profileError || !userProfile) {
        setErrorMsg('Perfil não provisionado. Solicite acesso ao administrador.')
        setLoading(false)
        return
      }

      if (!userProfile.active) {
        setErrorMsg('Seu acesso está inativo. Fale com o administrador.')
        setLoading(false)
        return
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userProfile.organization_id)
        .single()

      if (controller.signal.aborted) return

      if (orgError || !org) {
        setErrorMsg('Organização não encontrada para este perfil.')
        setLoading(false)
        return
      }

      setProfile(userProfile as Profile)
      setOrganization(org as Organization)
      setLoading(false)
    })()

    return () => controller.abort()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="mt-4 text-sm font-medium text-slate-500">Preparando formulário comercial...</span>
      </div>
    )
  }

  if (errorMsg || !profile || !organization) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {errorMsg ?? 'Não foi possível carregar seu perfil.'}
      </div>
    )
  }

  return <QuoteForm mode="create" profile={profile} organization={organization} />
}
