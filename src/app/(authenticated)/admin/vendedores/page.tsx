'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  Phone,
  CheckCircle,
  Pencil,
  AlertCircle,
  Search,
  X,
  KeyRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createSeller, updateSeller } from '@/app/(authenticated)/orcamentos/actions'
import { requestPasswordReset } from '@/app/login/actions'
import type { Profile, UserRole } from '@/types/database'

export default function AdminVendorsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [vendors, setVendors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVendor, setEditingVendor] = useState<Profile | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('seller')
  const [active, setActive] = useState(true)

  const [refreshToken, setRefreshToken] = useState(0)

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

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (controller.signal.aborted) return

      if (!myProfile || myProfile.role !== 'admin' || !myProfile.active) {
        setErrorMsg('Acesso restrito para administradores ativos.')
        setLoading(false)
        return
      }

      setCurrentProfile(myProfile as Profile)

      const { data: team, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', myProfile.organization_id)
        .order('full_name', { ascending: true })

      if (controller.signal.aborted) return

      if (error) {
        setErrorMsg(error.message)
      } else {
        setVendors((team as Profile[]) ?? [])
      }

      setLoading(false)
    })()

    return () => controller.abort()
  }, [router, supabase, refreshToken])

  const resetForm = () => {
    setEditingVendor(null)
    setIsNewModalOpen(false)
    setFullName('')
    setEmail('')
    setPassword('')
    setPhone('')
    setRole('seller')
    setActive(true)
    setErrorMsg(null)
  }

  const handleOpenEdit = (vendor: Profile) => {
    setEditingVendor(vendor)
    setIsNewModalOpen(false)
    setFullName(vendor.full_name)
    setEmail(vendor.email)
    setPhone(vendor.phone ?? '')
    setRole(vendor.role)
    setActive(vendor.active)
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setIsNewModalOpen(true)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (editingVendor) {
      const result = await updateSeller(editingVendor.id, { fullName, phone, role, active })
      setSubmitting(false)
      if (!result.ok) {
        setErrorMsg(result.error)
        return
      }
      setRefreshToken((value) => value + 1)
      resetForm()
      return
    }

    const result = await createSeller({ fullName, email, password, phone, role, active })
    setSubmitting(false)
    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setRefreshToken((value) => value + 1)
    resetForm()
    setSuccessMsg('Usuário criado. Ele deve alterar a senha provisória no primeiro acesso.')
  }

  const handleToggleStatus = async (vendor: Profile) => {
    if (!currentProfile) return
    if (vendor.id === currentProfile.id) {
      setErrorMsg('Você não pode desativar seu próprio acesso.')
      return
    }

    const result = await updateSeller(vendor.id, {
      fullName: vendor.full_name,
      phone: vendor.phone ?? '',
      role: vendor.role,
      active: !vendor.active,
    })

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setRefreshToken((value) => value + 1)
  }

  const handleSendReset = async (vendor: Profile) => {
    const result = await requestPasswordReset(vendor.email)
    setErrorMsg(result.ok ? null : result.error)
    if (result.ok) {
      setSuccessMsg(`E-mail de redefinição enviado para ${vendor.email}.`)
    }
  }

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors
    const term = searchQuery.toLowerCase().trim()
    return vendors.filter(
      (vendor) =>
        vendor.full_name.toLowerCase().includes(term) ||
        vendor.email.toLowerCase().includes(term) ||
        (vendor.phone ?? '').includes(term)
    )
  }, [vendors, searchQuery])

  const stats = useMemo(() => {
    return {
      total: vendors.length,
      activeCount: vendors.filter((vendor) => vendor.active).length,
      adminCount: vendors.filter((vendor) => vendor.role === 'admin').length,
      sellerCount: vendors.filter((vendor) => vendor.role === 'seller').length,
    }
  }, [vendors])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="mt-4 text-sm font-medium text-slate-500">Carregando equipe...</span>
      </div>
    )
  }

  const modalOpen = isNewModalOpen || Boolean(editingVendor)

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Equipe Comercial & Vendedores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie acessos, permissões e contatos que aparecem nos orçamentos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Novo Vendedor</span>
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Total</span>
          <span className="text-2xl font-bold text-slate-900 mt-2 block">{stats.total}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Ativos</span>
          <span className="text-2xl font-bold text-emerald-700 mt-2 block">{stats.activeCount}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Vendedores</span>
          <span className="text-2xl font-bold text-blue-700 mt-2 block">{stats.sellerCount}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Administradores</span>
          <span className="text-2xl font-bold text-purple-700 mt-2 block">{stats.adminCount}</span>
        </div>
      </div>

      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="vendor-search" className="sr-only">
            Buscar usuários
          </label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="vendor-search"
            type="search"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-300/80 py-2 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th scope="col" className="py-3.5 px-5">Vendedor / Usuário</th>
                <th scope="col" className="py-3.5 px-5">Telefone</th>
                <th scope="col" className="py-3.5 px-5 text-center">Perfil</th>
                <th scope="col" className="py-3.5 px-5 text-center">Status</th>
                <th scope="col" className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendors.map((vendor) => {
                const isMe = vendor.id === currentProfile?.id
                const initials = vendor.full_name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <tr key={vendor.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                          {initials || <Users className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{vendor.full_name}</span>
                            {isMe && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{vendor.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 text-slate-600">
                      {vendor.phone ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{vendor.phone}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 italic">Não configurado</span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                          vendor.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {vendor.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(vendor)}
                        disabled={isMe}
                        title={isMe ? 'Você não pode desativar seu próprio acesso' : 'Alternar status'}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          isMe ? 'cursor-default opacity-80' : 'cursor-pointer hover:opacity-90'
                        } ${
                          vendor.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${vendor.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span>{vendor.active ? 'Ativo' : 'Inativo'}</span>
                      </button>
                    </td>

                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(vendor)}
                        className="inline-flex items-center gap-1 p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer text-xs font-semibold"
                        aria-label={`Editar ${vendor.full_name}`}
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-dialog-title"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold">
                  {editingVendor ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 id="vendor-dialog-title" className="text-base font-bold text-slate-900">
                    {editingVendor ? 'Editar Vendedor' : 'Cadastrar Novo Vendedor'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingVendor ? editingVendor.email : 'Dados de acesso corporativo'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {editingVendor && (
              <button
                type="button"
                onClick={() => handleSendReset(editingVendor)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Enviar e-mail de redefinição de senha
              </button>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="vendor-full-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="vendor-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              {!editingVendor && (
                <div>
                  <label htmlFor="vendor-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    E-mail Corporativo <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="vendor-email"
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              {!editingVendor && (
                <div>
                  <label htmlFor="vendor-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Senha Provisória <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="vendor-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    A senha é enviada ao servidor e nunca fica no navegador nem em log.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="vendor-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Telefone / WhatsApp Comercial
                </label>
                <input
                  id="vendor-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(41) 99999-9999"
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="vendor-role" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nível de Permissão
                </label>
                <select
                  id="vendor-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none bg-white"
                >
                  <option value="seller">Vendedor (cria, edita e emite orçamentos)</option>
                  <option value="admin">Administrador (acesso total)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="vendor-active"
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                  disabled={editingVendor?.id === currentProfile?.id}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="vendor-active" className="text-xs font-semibold text-slate-600">
                  Usuário ativo (pode entrar e emitir)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Salvando...' : 'Salvar Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
