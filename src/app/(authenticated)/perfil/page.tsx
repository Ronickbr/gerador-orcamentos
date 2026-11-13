'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Phone,
  Mail,
  Building2,
  ShieldCheck,
  KeyRound,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateMyProfile } from '@/app/(authenticated)/orcamentos/actions'
import type { Organization, Profile } from '@/types/database'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
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
          .select('*, organization:organizations(*)')
          .eq('id', user.id)
          .single()

        if (controller.signal.aborted) return

        if (profileError || !userProfile) {
          setErrorMsg('Não foi possível carregar seu perfil.')
          setLoading(false)
          return
        }

        const raw = userProfile as Profile & { organization?: Organization | null }
        setProfile(raw)
        setOrganization(raw.organization ?? null)
        setFullName(raw.full_name || '')
        setPhone(raw.phone || '')
        setLoading(false)
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar perfil.')
          setLoading(false)
        }
      }
    })()

    return () => controller.abort()
  }, [router, supabase])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    setErrorMsg(null)
    setSuccessMsg(null)

    const trimmedName = fullName.trim()
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('Informe seu nome completo (mínimo de 2 caracteres).')
      return
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setErrorMsg('A nova senha deve ter ao menos 8 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('A confirmação da senha não coincide com a nova senha.')
        return
      }
    }

    setSaving(true)

    const result = await updateMyProfile({
      fullName: trimmedName,
      phone: phone.trim() || null,
      newPassword: newPassword || undefined,
    })

    setSaving(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setProfile(result.data)
    setFullName(result.data.full_name)
    setPhone(result.data.phone ?? '')
    setNewPassword('')
    setConfirmPassword('')
    setSuccessMsg('Perfil atualizado com sucesso!')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0072f5] border-t-transparent" />
        <span className="mt-4 text-xs font-medium text-zinc-400">Carregando perfil...</span>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/orcamentos"
            className="p-2 rounded-xl text-zinc-400 hover:text-white bg-[#18181b] border border-zinc-800 shadow-md hover:bg-zinc-800 transition-colors"
            title="Voltar aos orçamentos"
            aria-label="Voltar aos orçamentos"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Meu Perfil</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Atualize seus dados profissionais e gerencie suas credenciais de acesso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isAdmin
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isAdmin ? 'Administrador' : 'Vendedor Autorizado'}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="rounded-2xl border border-emerald-800/80 bg-emerald-950/60 p-4 text-xs text-emerald-200 flex items-start gap-3 backdrop-blur-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Sucesso!</span>
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl border border-red-800/80 bg-red-950/60 p-4 text-xs text-red-200 flex items-start gap-3 backdrop-blur-sm">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Atenção</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Info Notice Card */}
      <div className="rounded-2xl border border-blue-900/50 bg-gradient-to-r from-blue-950/40 to-indigo-950/30 p-4 sm:p-5 text-xs text-blue-200 flex items-start gap-3.5">
        <Info className="h-4 w-4 text-[#0072f5] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">
            Identificação em propostas e documentos comerciais
          </p>
          <p className="text-zinc-300 leading-relaxed">
            Seu <strong>nome completo</strong> e <strong>telefone/WhatsApp</strong> aparecem no
            cabeçalho das propostas comerciais emitidas para os clientes.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Dados Pessoais */}
        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
            <User className="h-4 w-4 text-[#0072f5]" />
            <h2 className="text-sm font-bold text-white">Dados Pessoais</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full rounded-xl border border-zinc-800 bg-[#121215] px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#0072f5] focus:outline-none"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Nome visível aos clientes nos orçamentos.
              </p>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Telefone / WhatsApp Comercial
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full rounded-xl border border-zinc-800 bg-[#121215] pl-10 pr-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#0072f5] focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Contato direto com os clientes.</p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                E-mail de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <input
                  id="email"
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full rounded-xl border border-zinc-800/60 bg-[#121215]/60 pl-10 pr-3.5 py-2.5 text-xs text-zinc-500 cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Identificador exclusivo da conta.</p>
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Empresa / Organização
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <input
                  id="company"
                  type="text"
                  disabled
                  value={organization?.display_name || 'Organização'}
                  className="w-full rounded-xl border border-zinc-800/60 bg-[#121215]/60 pl-10 pr-3.5 py-2.5 text-xs text-zinc-500 cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Organização vinculada.</p>
            </div>
          </div>
        </div>

        {/* Card 2: Segurança & Senha */}
        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
            <KeyRound className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Segurança & Senha</h2>
          </div>

          <p className="text-xs text-zinc-400">
            Deixe os campos abaixo em branco caso queira manter sua senha atual.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Nova Senha
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-800 bg-[#121215] px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#0072f5] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Confirmar Nova Senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-800 bg-[#121215] px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#0072f5] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/orcamentos"
            className="px-4 py-2 rounded-xl border border-zinc-800 bg-[#18181b] text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Voltar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0072f5] px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
