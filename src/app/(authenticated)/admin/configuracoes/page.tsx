'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Save,
  CheckCircle,
  AlertCircle,
  Palette,
  FileText,
  Phone,
  Mail,
  MapPin,
  Hash,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateOrganizationSettings } from '@/app/(authenticated)/orcamentos/actions'
import type { Organization } from '@/types/database'

export default function AdminSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [address, setAddress] = useState('')
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#1d4ed8')
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#3b82f6')
  const [quotePrefix, setQuotePrefix] = useState('ORC-')
  const [defaultValidityDays, setDefaultValidityDays] = useState('')

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (controller.signal.aborted) return

      if (!profile || profile.role !== 'admin' || !profile.active) {
        setErrorMsg('Acesso restrito para administradores ativos.')
        setLoading(false)
        return
      }

      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single()

      if (controller.signal.aborted) return

      if (error || !org) {
        setErrorMsg(error?.message ?? 'Organização não encontrada.')
        setLoading(false)
        return
      }

      const typedOrg = org as Organization
      setOrganization(typedOrg)
      setDisplayName(typedOrg.display_name)
      setLegalName(typedOrg.legal_name ?? '')
      setContactPhone(typedOrg.contact_phone ?? '')
      setContactEmail(typedOrg.contact_email ?? '')
      setAddress(typedOrg.address ?? '')
      setBrandPrimaryColor(typedOrg.brand_primary_color || '#1d4ed8')
      setBrandSecondaryColor(typedOrg.brand_secondary_color || '#3b82f6')
      setQuotePrefix(typedOrg.quote_prefix || 'ORC-')
      setDefaultValidityDays(typedOrg.default_validity_days ? String(typedOrg.default_validity_days) : '')
      setLoading(false)
    })()

    return () => controller.abort()
  }, [router, supabase])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organization || saving) return

    setSaving(true)
    setSuccessMsg(null)
    setErrorMsg(null)

    const result = await updateOrganizationSettings({
      display_name: displayName,
      legal_name: legalName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      address,
      brand_primary_color: brandPrimaryColor,
      brand_secondary_color: brandSecondaryColor,
      quote_prefix: quotePrefix,
      default_validity_days: defaultValidityDays ? Number(defaultValidityDays) : null,
    })

    setSaving(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setOrganization(result.data)
    setDefaultValidityDays(
      result.data.default_validity_days ? String(result.data.default_validity_days) : ''
    )
    setSuccessMsg('Configurações salvas e registradas na auditoria.')
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="mt-4 text-sm font-medium text-slate-500">Carregando configurações...</span>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {errorMsg ?? 'Organização indisponível.'}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Configurações da Empresa & Identidade Visual
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Dados oficiais, paleta e regras de emissão. Cada alteração incrementa a versão do template.
        </p>
      </div>

      {successMsg && (
        <div role="status" className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="flex items-center gap-2.5 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              1. Identidade e Dados Cadastrais
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="org-display-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Nome Comercial / Fantasia <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="org-legal-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Razão Social Oficial (opcional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-legal-name"
                  type="text"
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="org-address" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Endereço Institucional (impresso no rodapé)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-address"
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="org-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Telefone Institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="org-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                E-mail Institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Palette className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              2. Cores da Marca & Pré-visualização
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="org-primary-color" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Cor Primária
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="org-primary-color"
                    type="color"
                    value={brandPrimaryColor}
                    onChange={(event) => setBrandPrimaryColor(event.target.value)}
                    className="h-10 w-14 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    aria-label="Valor hexadecimal da cor primária"
                    type="text"
                    value={brandPrimaryColor}
                    onChange={(event) => setBrandPrimaryColor(event.target.value)}
                    className="w-36 rounded-xl border border-slate-300/80 py-2 px-3 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="org-secondary-color" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Cor Secundária
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="org-secondary-color"
                    type="color"
                    value={brandSecondaryColor}
                    onChange={(event) => setBrandSecondaryColor(event.target.value)}
                    className="h-10 w-14 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    aria-label="Valor hexadecimal da cor secundária"
                    type="text"
                    value={brandSecondaryColor}
                    onChange={(event) => setBrandSecondaryColor(event.target.value)}
                    className="w-36 rounded-xl border border-slate-300/80 py-2 px-3 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Pré-visualização
              </span>
              <div className="bg-white rounded-lg p-3 shadow-xs border border-slate-200 text-xs space-y-2">
                <div className="h-2 rounded-full w-full" style={{ backgroundColor: brandPrimaryColor }} />
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-slate-800">{displayName || 'Nome da Empresa'}</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: brandPrimaryColor }}
                  >
                    ORÇAMENTO
                  </span>
                </div>
                <div
                  className="text-[10px] text-slate-500 border-t pt-1"
                  style={{ borderColor: brandSecondaryColor }}
                >
                  {address || 'Endereço da empresa'} • {contactPhone || 'Telefone'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Hash className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              3. Regras de Emissão & Validade
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="org-quote-prefix" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Prefixo do Código de Orçamento
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Hash className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-quote-prefix"
                  type="text"
                  required
                  maxLength={12}
                  value={quotePrefix}
                  onChange={(event) => setQuotePrefix(event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Exemplo: <strong>{quotePrefix.replace(/-+$/, '') || 'ORC'}-1001</strong>
              </p>
            </div>

            <div>
              <label htmlFor="org-validity" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Validade Padrão Sugerida (dias)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="org-validity"
                  type="number"
                  min="1"
                  max="365"
                  value={defaultValidityDays}
                  onChange={(event) => setDefaultValidityDays(event.target.value)}
                  placeholder="Ex: 15"
                  className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Aplicada só quando o orçamento não tiver validade própria.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 py-3 px-6 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Gravando alterações...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
