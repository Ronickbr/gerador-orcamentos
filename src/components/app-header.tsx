'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Profile, Organization } from '@/types/database'
import {
  Search,
  Bell,
  PlusCircle,
  MessageSquare,
  Menu,
} from 'lucide-react'

interface AppHeaderProps {
  profile: Profile | null
  organization?: Organization | null
  onOpenMobileSidebar?: () => void
}

export function AppHeader({
  profile,
  onOpenMobileSidebar,
}: AppHeaderProps) {
  const router = useRouter()
  const [searchVal, setSearchVal] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchVal.trim()) return
    router.push(`/orcamentos?q=${encodeURIComponent(searchVal.trim())}`)
  }

  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-zinc-800/80 bg-[#0e0e10]/80 px-4 sm:px-6 lg:px-8 backdrop-blur-md no-print transition-all">
      <div className="flex h-full items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              aria-label="Abrir menu lateral"
              className="lg:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/70 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Search Pill Input (Matching NextUI Screenshot) */}
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="search"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Buscar orçamentos, clientes, vendedores..."
              className="w-full rounded-full border border-zinc-800 bg-[#18181b] py-2 pl-9 pr-4 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 transition-all focus:border-[#0072f5] focus:bg-[#18181b] focus:ring-2 focus:ring-[#0072f5]/20 focus:outline-none"
            />
          </form>
        </div>

        {/* Right: Quick Actions, Notifications, User Avatar */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* CTA: Novo Orçamento */}
          <Link
            href="/orcamentos/novo"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#0072f5] px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-600 active:scale-95"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Novo Orçamento</span>
          </Link>

          {/* Feedback & Help links (Desktop) */}
          <div className="hidden md:flex items-center gap-1 text-zinc-400">
            <Link
              href="/orcamentos"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Feedback?</span>
            </Link>
          </div>

          {/* Notification Bell with Functional Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              title="Notificações e Avisos"
              aria-expanded={notificationsOpen}
              className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                notificationsOpen
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
              }`}
            >
              <Bell className="h-4 w-4" />
            </button>

            {/* Notification Popover Dropdown */}
            {notificationsOpen && (
              <div
                role="dialog"
                aria-label="Painel de Notificações"
                className="absolute right-0 mt-2 w-72 rounded-2xl border border-zinc-800 bg-[#18181b] p-4 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                  <span className="font-bold text-white text-xs">Notificações</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                    Sistema Ativo
                  </span>
                </div>
                <div className="space-y-2 text-zinc-300">
                  <div className="p-2.5 rounded-xl bg-[#121215] border border-zinc-800/80">
                    <span className="font-semibold text-zinc-200 block text-[11px]">
                      Orçamentos em Tempo Real
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      Suas propostas e valores são calculados diretamente com dados do banco de dados.
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800 text-center">
                  <Link
                    href="/orcamentos"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[11px] font-semibold text-[#0072f5] hover:underline"
                  >
                    Ver todas as propostas
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar with glowing purple/blue ring (as in screenshot) */}
          <Link
            href="/perfil"
            title={`${profile?.full_name || 'Usuário'} - Ver Perfil`}
            className="flex items-center gap-2 group"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 p-[2px] transition-transform group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#18181b] text-white font-bold text-xs">
                {getInitials(profile?.full_name)}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#17c964] ring-2 ring-[#0e0e10]" />
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}
