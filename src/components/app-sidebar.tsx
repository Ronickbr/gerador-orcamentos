'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types/database'
import {
  FileText,
  PlusCircle,
  Users,
  Settings,
  LogOut,
  UserCircle,
  ShieldCheck,
  ChevronRight,
  ChevronsUpDown,
} from 'lucide-react'

interface AppSidebarProps {
  profile: Profile | null
  organization: Organization | null
  isMobileOpen?: boolean
  setIsMobileOpen?: (open: boolean) => void
}

export function AppSidebar({
  profile,
  organization,
  isMobileOpen: controlledMobileOpen,
  setIsMobileOpen: setControlledMobileOpen,
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [internalMobileOpen, setInternalMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const supabase = createClient()

  const isMobileOpen = controlledMobileOpen ?? internalMobileOpen
  const setIsMobileOpen = setControlledMobileOpen ?? setInternalMobileOpen

  // Fechar menu mobile com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileOpen, setIsMobileOpen])

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

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const isLinkActive = (href: string) => {
    if (href === '/orcamentos') {
      return pathname === '/orcamentos' || (pathname.startsWith('/orcamentos/') && pathname !== '/orcamentos/novo')
    }
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto bg-[#0e0e10] border-r border-zinc-800/80 select-none">
      <div className="p-4 space-y-6">
        {/* Organization / Brand Header Card (NextUI Acme Co. style) */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl border border-zinc-800/90 bg-[#18181b]/60 backdrop-blur-sm transition-all hover:border-zinc-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800/90 p-1 shadow-md shadow-black/25">
              <Image
                src="/Logo_mini_red.png"
                alt={organization?.display_name || 'Logo'}
                width={32}
                height={32}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <span
                className="text-sm font-bold text-white block truncate leading-tight tracking-tight"
                title={organization?.display_name || 'Orçamentos'}
              >
                {organization?.display_name || 'Empresa'}
              </span>
              <span className="text-[11px] font-medium text-zinc-400 block truncate mt-0.5">
                {isAdmin ? 'Administração Geral' : 'Painel de Vendas'}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-zinc-500 shrink-0" />
        </div>

        {/* Primary Action Button (Novo Orçamento) */}
        <Link
          href="/orcamentos/novo"
          onClick={() => setIsMobileOpen(false)}
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 shadow-md cursor-pointer ${
            pathname === '/orcamentos/novo'
              ? 'bg-blue-700 text-white ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0e0e10]'
              : 'bg-[#0072f5] hover:bg-blue-600 active:scale-[0.98] text-white shadow-blue-600/25'
          }`}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span>Novo Orçamento</span>
        </Link>

        {/* Navigation Categories */}
        <nav className="space-y-6 pt-1" aria-label="Menu Lateral">
          {/* Main Menu */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Menu Principal
            </div>
            <div className="space-y-1.5">
              <Link
                href="/orcamentos"
                onClick={() => setIsMobileOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isLinkActive('/orcamentos')
                    ? 'bg-[#0072f5] text-white font-semibold shadow-lg shadow-blue-600/25'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4" />
                  <span>Orçamentos</span>
                </div>
                {isLinkActive('/orcamentos') && <ChevronRight className="h-4 w-4 text-white" />}
              </Link>
            </div>
          </div>

          {/* Admin Menu */}
          {isAdmin && (
            <div>
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Administração
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-purple-950/70 text-purple-300 border border-purple-800/60">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Admin
                </span>
              </div>
              <div className="space-y-1.5">
                <Link
                  href="/admin/vendedores"
                  onClick={() => setIsMobileOpen(false)}
                  className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    pathname.startsWith('/admin/vendedores')
                      ? 'bg-[#0072f5] text-white font-semibold shadow-lg shadow-blue-600/25'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4" />
                    <span>Vendedores</span>
                  </div>
                  {pathname.startsWith('/admin/vendedores') && (
                    <ChevronRight className="h-4 w-4 text-white" />
                  )}
                </Link>

                <Link
                  href="/admin/configuracoes"
                  onClick={() => setIsMobileOpen(false)}
                  className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    pathname.startsWith('/admin/configuracoes')
                      ? 'bg-[#0072f5] text-white font-semibold shadow-lg shadow-blue-600/25'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                  </div>
                  {pathname.startsWith('/admin/configuracoes') && (
                    <ChevronRight className="h-4 w-4 text-white" />
                  )}
                </Link>
              </div>
            </div>
          )}

          {/* General / System */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Conta & Sistema
            </div>
            <div className="space-y-1.5">
              <Link
                href="/perfil"
                onClick={() => setIsMobileOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  pathname === '/perfil'
                    ? 'bg-[#0072f5] text-white font-semibold shadow-lg shadow-blue-600/25'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserCircle className="h-4 w-4" />
                  <span>Meu Perfil</span>
                </div>
                {pathname === '/perfil' && <ChevronRight className="h-4 w-4 text-white" />}
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Footer User Info & Actions */}
      <div className="p-4 border-t border-zinc-800/80 bg-[#121215]/80 space-y-3">
        {/* User Card */}
        <Link
          href="/perfil"
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-3 p-2 rounded-xl border border-zinc-800/80 bg-[#18181b]/50 hover:bg-zinc-800/60 transition-all group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 p-[2px]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#18181b] text-white font-bold text-xs">
              {getInitials(profile?.full_name)}
            </div>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="text-xs font-semibold text-zinc-100 block truncate group-hover:text-blue-400 transition-colors">
              {profile?.full_name || 'Usuário'}
            </span>
            <span className="text-[10px] text-zinc-400 block truncate">
              {isAdmin ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/perfil"
            onClick={() => setIsMobileOpen(false)}
            title="Configurações do Perfil"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-[#18181b] text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-zinc-400" />
            <span>Ajustes</span>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            title="Encerrar Sessão"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-950/50 bg-red-950/20 text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
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
      {/* Desktop Sidebar (Fixed left) */}
      <aside
        className="hidden lg:block fixed inset-y-0 left-0 z-30 w-64 h-screen no-print select-none"
        aria-label="Barra Lateral"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-over) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
