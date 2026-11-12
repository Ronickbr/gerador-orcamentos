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
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="mt-4 text-sm font-medium text-slate-500">Carregando perfil...</span>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/orcamentos"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 shadow-xs hover:bg-slate-50 transition-colors"
            title="Voltar aos orçamentos"
            aria-label="Voltar aos orçamentos"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Meu Perfil
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Atualize suas informações de vendedor e gerencie seu acesso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isAdmin
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isAdmin ? 'Administrador' : 'Vendedor Autorizado'}
          </span>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Sucesso!</span>
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* Alerta de Erro */}
      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-3 animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Atenção</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Card de Informação sobre Identificação nos Orçamentos */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-4 sm:p-5 text-sm text-blue-900 flex items-start gap-3.5">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm">
          <p className="font-semibold text-blue-950">
            Identificação em propostas e documentos comerciais
          </p>
          <p className="text-blue-800 leading-relaxed">
            Seu <strong>nome completo</strong> e <strong>telefone/WhatsApp</strong> aparecem nas propostas emitidas para os clientes e no cabeçalho do sistema.
          </p>
          <p className="text-blue-700 pt-1 text-xs border-t border-blue-200/60">
            <strong>Regra de integridade:</strong> Orçamentos nunca são excluídos do sistema. Caso uma proposta seja descartada ou recusada pelo cliente, utilize o botão <em>Cancelar</em> para manter a rastreabilidade e histórico no banco de dados.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Dados Pessoais & Contato */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Dados Pessoais</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Nome visível aos clientes nos orçamentos.
              </p>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Telefone / WhatsApp Comercial
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Utilizado para contato direto do cliente.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                E-mail de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Identificador único da sua conta de acesso.
              </p>
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Empresa / Organização
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <input
                  id="company"
                  type="text"
                  disabled
                  value={organization?.display_name || 'Organização'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Organização à qual você pertence no sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Segurança & Senha */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Segurança & Senha</h2>
          </div>

          <p className="text-xs text-slate-500">
            Preencha os campos abaixo apenas se desejar alterar sua senha de login. Caso queira manter a senha atual, deixe-os em branco.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {/* Botão de Salvar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/orcamentos"
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Voltar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

