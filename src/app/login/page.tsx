'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
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

    setSuccessMsg('Senha atualizada com sucesso. Você será redirecionado...')
    setMode('login')
    setTimeout(() => {
      router.push('/orcamentos')
      router.refresh()
    }, 1200)
  }

  return (
    <div className="relative isolate grid min-h-screen grid-cols-[minmax(0,1fr)] place-items-center bg-[#0a0f1d] px-5 py-8 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif] leading-[normal] text-white scheme-dark before:absolute before:inset-0 before:-z-2 before:bg-[radial-gradient(55%_45%_at_85%_18%,rgba(168,85,247,0.18),transparent_60%),radial-gradient(50%_50%_at_15%_25%,rgba(244,63,94,0.12),transparent_60%),radial-gradient(65%_55%_at_50%_90%,rgba(14,165,233,0.18),transparent_65%),linear-gradient(160deg,#111827_0%,#080d1a_60%,#030712_100%)] after:absolute after:inset-0 after:-z-1 after:bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.45)_100%)]">
      <div className="w-full max-w-[410px] text-center">
        {/* Brand / Logo */}
        <div className="mb-6 flex flex-col items-center justify-center">
          <Image
            src="/Logo_mini_red.png"
            alt="Logo"
            width={60}
            height={80}
            className="h-16 w-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
            priority
          />
          <h1 className="mt-3 text-[1.25rem] font-bold tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,.7)]">
            Gerador de Orçamentos
          </h1>
        </div>

        {/* Semantic Landmark: Main Card */}
        <main className="rounded-[24px] border border-white/[0.08] bg-[#0c1322]/85 px-7 py-8 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          {/* Header Texts */}
          {mode === 'login' && (
            <div className="mb-6">
              <h2 className="text-[1.5rem] font-bold tracking-tight text-white">Bem-vindo de volta</h2>
              <p className="mt-1 text-[.88rem] text-zinc-400">Acesse para continuar de onde parou.</p>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-[1.5rem] font-bold tracking-tight text-white">Recuperar senha</h2>
              <p className="mt-1 text-[.88rem] text-zinc-400">
                Informe seu e-mail corporativo para receber o link de redefinição.
              </p>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-[1.5rem] font-bold tracking-tight text-white">Definir nova senha</h2>
              <p className="mt-1 text-[.88rem] text-zinc-400">Digite a nova senha de acesso à plataforma.</p>
            </div>
          )}

          {/* Accessible Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/60 p-3.5 text-sm text-red-200 backdrop-blur-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div className="flex-1">
                <span className="block font-semibold text-red-100">Não foi possível continuar</span>
                <p className="text-xs leading-relaxed text-red-300">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Accessible Status Alert */}
          {successMsg && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-3.5 text-sm text-emerald-200 backdrop-blur-sm"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-xs leading-relaxed text-emerald-100">{successMsg}</p>
            </div>
          )}

          {/* Mode: Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-zinc-300" htmlFor="bmail">
                  E-mail corporativo
                </label>
                <input
                  className="w-full rounded-xl border border-[#233149] bg-[#141d2e] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-blue-500 focus:bg-[#162238] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  id="bmail"
                  name="username"
                  type="email"
                  autoComplete="username"
                  placeholder="vendedor@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-zinc-300" htmlFor="bpw">
                  Senha de acesso
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-[#233149] bg-[#141d2e] px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-blue-500 focus:bg-[#162238] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    id="bpw"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm pt-1 pb-1">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-zinc-300 select-none">
                  <input
                    className="h-4 w-4 rounded border-zinc-700 bg-[#141d2e] accent-white cursor-pointer"
                    type="checkbox"
                    name="remember"
                  />
                  <span>Lembrar-me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="font-bold text-white underline underline-offset-4 hover:text-zinc-200 transition-colors cursor-pointer bg-transparent border-0 p-0"
                  aria-label="Forgot password? Recuperar senha"
                >
                  Esqueceu?
                </button>
              </div>

              <button
                className="w-full cursor-pointer rounded-xl bg-white py-3.5 px-4 text-sm font-bold text-zinc-950 transition-all hover:bg-zinc-100 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-black/20"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar Painel</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode: Forgot Password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-zinc-300" htmlFor="forgot-email">
                  E-mail corporativo cadastrado
                </label>
                <input
                  className="w-full rounded-xl border border-[#233149] bg-[#141d2e] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-blue-500 focus:bg-[#162238] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  id="forgot-email"
                  name="username"
                  type="email"
                  autoComplete="username"
                  placeholder="vendedor@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                className="w-full cursor-pointer rounded-xl bg-white py-3.5 px-4 text-sm font-bold text-zinc-950 transition-all hover:bg-zinc-100 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-black/20"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  'Enviar link de redefinição'
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="text-xs font-medium text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer bg-transparent border-0"
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          )}

          {/* Mode: Reset Password */}
          {mode === 'reset' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-zinc-300" htmlFor="reset-pw">
                  Nova senha (mínimo 8 caracteres)
                </label>
                <input
                  className="w-full rounded-xl border border-[#233149] bg-[#141d2e] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-blue-500 focus:bg-[#162238] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  id="reset-pw"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="••••••••"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>

              <button
                className="w-full cursor-pointer rounded-xl bg-white py-3.5 px-4 text-sm font-bold text-zinc-950 transition-all hover:bg-zinc-100 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-black/20"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  'Salvar nova senha'
                )}
              </button>
            </form>
          )}

          {/* Security badge footer inside card */}
          <div className="mt-6 border-t border-white/[0.08] pt-5 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Ambiente seguro com permissão por organização</span>
          </div>
        </main>

        {/* Outer footer description */}
        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400 [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">
          Sistema de Emissão e Padronização de Propostas Comerciais
        </p>
      </div>
    </div>
  )
}
