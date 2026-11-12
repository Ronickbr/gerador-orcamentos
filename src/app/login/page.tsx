'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { requestPasswordReset, setNewPassword } from '@/app/login/actions'

type Mode = 'login' | 'forgot' | 'reset'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const loginPendingRef = useRef(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    // Lido no cliente para não acoplar a página a useSearchParams/Suspense.
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reset') === '1') setMode('reset')
      if (params.get('error') === 'recovery') {
        setErrorMsg('Link de recuperação inválido ou expirado. Solicite um novo.')
      }
    }, 0)
    return () => clearTimeout(timeout)
  }, [])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    // Guarda por ref: Enter repetido pode disparar antes do estado `loading` renderizar.
    if (loginPendingRef.current) return
    loginPendingRef.current = true

    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setErrorMsg('E-mail ainda não confirmado. Confirme pelo link enviado ou peça ao administrador.')
        } else if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('E-mail ou senha incorretos.')
        } else {
          setErrorMsg(error.message)
        }
        loginPendingRef.current = false
        setLoading(false)
        return
      }

      if (!data.session) {
        setErrorMsg('Login não retornou sessão. Tente novamente.')
        loginPendingRef.current = false
        setLoading(false)
        return
      }

      // Sucesso: mantém o botão em "Entrando..." até a navegação concluir
      // (sem reset de loading/pending, para não reabrir o formulário por um instante).
      router.replace('/orcamentos')
      router.refresh()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro inesperado ao entrar.')
      loginPendingRef.current = false
      setLoading(false)
    }
  }

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loginPendingRef.current) return
    loginPendingRef.current = true
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    const result = await requestPasswordReset(email)
    loginPendingRef.current = false
    setLoading(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setSuccessMsg(
      'Se este e-mail existir, enviamos um link de redefinição. Verifique também a caixa de spam.'
    )
  }

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loginPendingRef.current) return
    loginPendingRef.current = true
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    const result = await setNewPassword(resetPassword)
    loginPendingRef.current = false
    setLoading(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setSuccessMsg('Senha atualizada. Você será levado ao painel.')
    setMode('login')
    setTimeout(() => {
      router.push('/orcamentos')
      router.refresh()
    }, 1200)
  }

  const title =
    mode === 'forgot'
      ? 'Recuperar Acesso'
      : mode === 'reset'
        ? 'Definir Nova Senha'
        : 'Acesso ao Sistema'

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Gestão de propostas comerciais e emissão em papel timbrado
            </p>
          </div>

          {errorMsg && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl bg-red-50/90 p-4 text-sm text-red-800 border border-red-200/80">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>
                <span className="font-semibold block text-red-900">Não foi possível continuar</span>
                <p className="text-xs leading-relaxed text-red-700">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div role="status" className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50/90 p-4 text-sm text-emerald-800 border border-emerald-200/80">
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <p className="text-xs leading-relaxed text-emerald-700">{successMsg}</p>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="vendedor@empresa.com"
                    className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Senha de acesso
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setErrorMsg(null)
                      setSuccessMsg(null)
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar Painel</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="vendedor@empresa.com"
                    className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMsg(null)
                  setSuccessMsg(null)
                }}
                className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Voltar ao login
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nova senha (mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Controle de permissão por organização</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Sistema de Emissão e Padronização de Propostas Comerciais
        </p>
      </div>
    </div>
  )
}

