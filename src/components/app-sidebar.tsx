'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types/database'
import {
  FileText,
  PlusCircle,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Phone,
  UserCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'

interface AppSidebarProps {
  profile: Profile | null
  organization: Organization | null
}

export function AppSidebar({ profile, organization }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const supabase = createClient()

  // Fechar menu mobile ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileOpen])

  const handleSignOut = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setLoggingOut(false)
        return
      }
      router.replace('/login')
      router.refresh()
    } catch {
      setLoggingOut(false)
    }
  }

  const isAdmin = profile?.role === 'admin'
  const sellerPhone = profile?.phone

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const mainLinks = [
    {
      href: '/orcamentos',
      label: 'Orçamentos',
      icon: FileText,
      exact: false,
    },
  ]

  const adminLinks = [
    {
      href: '/admin/vendedores',
      label: 'Vendedores',
      icon: Users,
    },
    {
      href: '/admin/configuracoes',
      label: 'Configurações',
      icon: Settings,
    },
  ]

  const isLinkActive = (href: string) => {
    if (href === '/orcamentos') {
      return pathname === '/orcamentos' || (pathname.startsWith('/orcamentos/') && pathname !== '/orcamentos/novo')
    }
    return pathname.startsWith(href)
  }

  const isNewQuoteActive = pathname === '/orcamentos/novo'

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto bg-white border-r border-slate-200/80">
      {/* Topo do Sidebar: Marca e Ação Primária */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* Identidade da Empresa */}
        <div className="flex items-center gap-3 px-1">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm shadow-blue-500/20">
            <Building2 className="h-5 w-5" />
            <div
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/30"
              title="Sistema Online"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className="text-sm font-bold text-slate-900 block truncate leading-tight tracking-tight"
              title={organization?.display_name || 'Orçamentos'}
            >
              {organization?.display_name || 'Orçamentos'}
            </span>
            <span className="text-[11px] font-medium text-slate-400 block leading-none mt-1">
              Propostas & Vendas
            </span>
          </div>
        </div>

        {/* Botão de Destaque: Novo Orçamento (Único CTA global) */}
        <Link
          href="/orcamentos/novo"
          onClick={() => setIsMobileOpen(false)}
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm cursor-pointer ${
            isNewQuoteActive
              ? 'bg-blue-700 text-white ring-2 ring-blue-600 ring-offset-2'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-blue-500/20'
          }`}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span>Novo Orçamento</span>
        </Link>

        {/* Navegação Principal */}
        <nav className="space-y-6 pt-1" aria-label="Menu Lateral">
          <div>
            <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Menu
            </div>
            <div className="space-y-1">
              {mainLinks.map((item) => {
                const Icon = item.icon
                const active = isLinkActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 transition-colors ${
                          active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {active && <ChevronRight className="h-3.5 w-3.5 text-blue-600" />}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Painel Administrativo */}
          {isAdmin && (
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Administração
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200/60">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Admin
                </span>
              </div>
              <div className="space-y-1">
                {adminLinks.map((item) => {
                  const Icon = item.icon
                  const active = pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'bg-purple-50 text-purple-700 font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 transition-colors ${
                            active ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-purple-600" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Rodapé do Sidebar: Card de Usuário e Ações */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 space-y-3">
        {/* Card do Usuário */}
        <Link
          href="/perfil"
          onClick={() => setIsMobileOpen(false)}
          title="Ver e editar meu perfil"
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-200/70 transition-all group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200/60 shadow-xs group-hover:scale-105 transition-transform">
            {getInitials(profile?.full_name)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">
                {profile?.full_name || 'Usuário'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
              {sellerPhone ? (
                <>
                  <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{sellerPhone}</span>
                </>
              ) : (
                <span className="text-slate-400">Perfil de {isAdmin ? 'Administrador' : 'Vendedor'}</span>
              )}
            </div>
          </div>
        </Link>

        {/* Ações: Perfil e Sair */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            href="/perfil"
            onClick={() => setIsMobileOpen(false)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-xs transition-all ${
              pathname === '/perfil'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <UserCircle className="h-3.5 w-3.5 text-slate-500" />
            <span>Perfil</span>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            title="Sair do sistema"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{loggingOut ? '...' : 'Sair'}</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* =========================================================================
          1. DESKTOP SIDEBAR (Fixo à esquerda em telas >= lg)
          ========================================================================= */}
      <aside
        className="hidden lg:block fixed inset-y-0 left-0 z-30 w-64 h-screen no-print select-none"
        aria-label="Barra Lateral"
      >
        {sidebarContent}
      </aside>

      {/* =========================================================================
          2. MOBILE TOPBAR (Visível apenas em telas < lg)
          ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
            className="p-2 -ml-1 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors cursor-pointer"
          >
            {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link href="/orcamentos" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xs">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm truncate max-w-[180px]">
              {organization?.display_name || 'Orçamentos'}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/orcamentos/novo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Novo</span>
          </Link>

          <Link
            href="/perfil"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200"
            title="Meu Perfil"
          >
            {getInitials(profile?.full_name)}
          </Link>
        </div>
      </header>

      {/* =========================================================================
          3. MOBILE DRAWER (Slide-over a partir da esquerda)
          ========================================================================= */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print animate-in fade-in duration-200">
          {/* Backdrop escurecido */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Gaveta lateral deslizante */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

