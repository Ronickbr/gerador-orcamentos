'use client'

import React, { useState } from 'react'
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
  UserCircle
} from 'lucide-react'

interface AppHeaderProps {
  profile: Profile | null
  organization: Organization | null
}

export function AppHeader({ profile, organization }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const supabase = createClient()

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

  const navLinks = [
    { href: '/orcamentos', label: 'Orçamentos', icon: FileText },
    { href: '/orcamentos/novo', label: 'Novo Orçamento', icon: PlusCircle, highlight: true },
  ]

  const adminLinks = [
    { href: '/admin/vendedores', label: 'Vendedores', icon: Users },
    { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs no-print transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Identidade da Empresa / Logo */}
        <div className="flex items-center gap-8">
          <Link 
            href="/orcamentos" 
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-1"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Building2 className="h-5 w-5" />
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" title="Sistema Online" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 block leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
                {organization?.display_name || 'Orçamentos'}
              </span>
              <span className="text-xs font-medium text-slate-400 block leading-none mt-0.5">
                Propostas & Vendas
              </span>
            </div>
          </Link>

          {/* Links Desktop */}
          <nav className="hidden md:flex items-center space-x-1.5" aria-label="Navegação Principal">
            {navLinks.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href

              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition-all ml-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-blue-50/80 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-500'}`} />
                  {item.label}
                </Link>
              )
            })}

            {isAdmin && (
              <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-3 ml-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden lg:inline">
                  Admin
                </span>
                {adminLinks.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'bg-slate-100 text-slate-900 font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Dados do Vendedor e Ações do Usuário */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/perfil"
            title="Editar meu perfil"
            className="flex items-center gap-3 pl-4 border-l border-slate-200 py-1 px-2 rounded-xl hover:bg-slate-50 transition-colors group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shadow-xs group-hover:border-blue-400 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              {getInitials(profile?.full_name)}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-800 leading-none group-hover:text-blue-600 transition-colors">
                  {profile?.full_name || 'Usuário'}
                </span>
                <span className={`inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${
                  isAdmin 
                    ? 'bg-purple-100 text-purple-700 border border-purple-200/60' 
                    : 'bg-blue-100 text-blue-700 border border-blue-200/60'
                }`}>
                  {isAdmin ? 'Admin' : 'Vendedor'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                <Phone className="h-3 w-3 text-slate-400" />
                <span>{sellerPhone || 'Sem telefone'}</span>
              </div>
            </div>
          </Link>

          <Link
            href="/perfil"
            title="Editar meu perfil"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-all ${
              pathname === '/perfil'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <UserCircle className="h-3.5 w-3.5" />
            <span>Perfil</span>
          </Link>

          <button
            onClick={handleSignOut}
            disabled={loggingOut}
            title="Sair da conta"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{loggingOut ? 'Saindo...' : 'Sair'}</span>
          </button>
        </div>

        {/* Botão Mobile */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menu"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <Link
            href="/perfil"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                {getInitials(profile?.full_name)}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                  <span>{profile?.full_name}</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {isAdmin ? 'Admin' : 'Vendedor'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  <span>{sellerPhone || 'Telefone não cadastrado'}</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-600 mr-1">Editar</span>
          </Link>

          <div className="space-y-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  item.highlight
                    ? 'bg-blue-600 text-white'
                    : pathname === item.href
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            <Link
              href="/perfil"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                pathname === '/perfil'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <UserCircle className="h-4 w-4 text-slate-500" />
              Meu Perfil
            </Link>
          </div>

          {isAdmin && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 mb-1.5">
                Painel Administrativo
              </div>
              <div className="space-y-1">
                {adminLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                      pathname === item.href
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4 text-slate-500" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? 'Saindo...' : 'Sair do Sistema'}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
