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
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createSeller, updateSeller, deleteSeller } from '@/app/(authenticated)/orcamentos/actions'
import { requestPasswordReset } from '@/app/login/actions'
import type { Profile, UserRole } from '@/types/database'

export default function AdminVendorsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [vendors, setVendors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVendor, setEditingVendor] = useState<Profile | null>(null)
  const [deletingVendor, setDeletingVendor] = useState<Profile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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

  const handleConfirmDelete = async () => {
    if (!deletingVendor || isDeleting) return
    setIsDeleting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const result = await deleteSeller(deletingVendor.id)
    setIsDeleting(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      setDeletingVendor(null)
      return
    }

    setSuccessMsg(`Usuário "${deletingVendor.full_name}" foi excluído com sucesso.`)
    setDeletingVendor(null)
    setRefreshToken((value) => value + 1)
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0072f5] border-t-transparent" />
        <span className="mt-4 text-xs font-medium text-zinc-400">Carregando equipe...</span>
      </div>
    )
  }

  const modalOpen = isNewModalOpen || Boolean(editingVendor)

  return (
    <div className="space-y-6 pb-20 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Equipe Comercial & Vendedores
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gerencie acessos, papéis e números de WhatsApp que aparecem nos orçamentos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0072f5] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-600 active:scale-95 transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Novo Vendedor</span>
        </button>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl bg-red-950/60 p-4 border border-red-800/80 text-xs text-red-200 backdrop-blur-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-emerald-950/60 p-4 border border-emerald-800/80 text-xs text-emerald-200 backdrop-blur-sm"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stats Cards (NextUI Dark Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Total Membros
          </span>
          <span className="text-2xl font-extrabold text-white mt-2 block font-mono">
            {stats.total}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Ativos
          </span>
          <span className="text-2xl font-extrabold text-[#17c964] mt-2 block font-mono">
            {stats.activeCount}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Vendedores
          </span>
          <span className="text-2xl font-extrabold text-[#0072f5] mt-2 block font-mono">
            {stats.sellerCount}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-5 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Administradores
          </span>
          <span className="text-2xl font-extrabold text-purple-400 mt-2 block font-mono">
            {stats.adminCount}
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-[#18181b] p-4 shadow-xl">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            id="vendor-search"
            type="search"
            placeholder="Buscar por nome, e-mail ou WhatsApp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#0072f5] focus:outline-none focus:ring-1 focus:ring-[#0072f5]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table of Vendors */}
      <div className="rounded-2xl border border-zinc-800 bg-[#18181b] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121215] text-[10px] uppercase font-bold tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th scope="col" className="py-3 px-4">Vendedor / Usuário</th>
                <th scope="col" className="py-3 px-4">WhatsApp Comercial</th>
                <th scope="col" className="py-3 px-4 text-center">Perfil</th>
                <th scope="col" className="py-3 px-4 text-center">Status</th>
                <th scope="col" className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredVendors.map((vendor) => {
                const isMe = vendor.id === currentProfile?.id
                const initials = vendor.full_name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <tr key={vendor.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 p-[1.5px]">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#18181b] text-white font-bold text-[10px]">
                            {initials || <Users className="h-4 w-4" />}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-100 flex items-center gap-2">
                            <span>{vendor.full_name}</span>
                            {isMe && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500">{vendor.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-300">
                      {vendor.phone ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <Phone className="h-3 w-3 text-zinc-500" />
                          <span>{vendor.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic">Não informado</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          vendor.role === 'admin'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {vendor.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(vendor)}
                        disabled={isMe}
                        title={isMe ? 'Você não pode desativar seu próprio acesso' : 'Alternar status'}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                          isMe ? 'cursor-default opacity-80' : 'cursor-pointer hover:scale-105'
                        } ${
                          vendor.active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${vendor.active ? 'bg-[#17c964]' : 'bg-rose-500'}`}
                        />
                        <span>{vendor.active ? 'Ativo' : 'Inativo'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(vendor)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer text-xs font-semibold"
                        >
                          <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null)
                            setDeletingVendor(vendor)
                          }}
                          disabled={isMe}
                          title={isMe ? 'Você não pode excluir seu próprio usuário' : 'Excluir usuário'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-dialog-title"
            className="bg-[#18181b] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0072f5] to-indigo-600 text-white font-bold">
                  {editingVendor ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 id="vendor-dialog-title" className="text-base font-bold text-white">
                    {editingVendor ? 'Editar Vendedor' : 'Cadastrar Novo Vendedor'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {editingVendor ? editingVendor.email : 'Acesso corporativo'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="text-zinc-500 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-red-950/60 p-3 text-xs text-red-200 border border-red-800/80">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {editingVendor && (
              <button
                type="button"
                onClick={() => handleSendReset(editingVendor)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0072f5] hover:underline"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Enviar e-mail de redefinição de senha
              </button>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="vendor-full-name"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                >
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  id="vendor-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 px-3 text-xs text-zinc-100 focus:border-[#0072f5] focus:outline-none"
                />
              </div>

              {!editingVendor && (
                <div>
                  <label
                    htmlFor="vendor-email"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                  >
                    E-mail Corporativo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="vendor-email"
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 px-3 text-xs text-zinc-100 focus:border-[#0072f5] focus:outline-none"
                  />
                </div>
              )}

              {!editingVendor && (
                <div>
                  <label
                    htmlFor="vendor-password"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                  >
                    Senha Provisória <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="vendor-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#0072f5] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="vendor-phone"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                >
                  WhatsApp Comercial
                </label>
                <input
                  id="vendor-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(41) 99999-9999"
                  className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#0072f5] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vendor-role"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1"
                >
                  Nível de Permissão
                </label>
                <select
                  id="vendor-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-zinc-800 bg-[#121215] py-2 px-3 text-xs text-zinc-100 focus:border-[#0072f5] focus:outline-none"
                >
                  <option value="seller">Vendedor (cria, edita e emite orçamentos)</option>
                  <option value="admin">Administrador (acesso total)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="vendor-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={editingVendor?.id === currentProfile?.id}
                  className="h-4 w-4 rounded accent-[#0072f5]"
                />
                <label htmlFor="vendor-active" className="text-xs font-semibold text-zinc-300">
                  Usuário ativo (pode acessar o sistema)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0072f5] hover:bg-blue-600 rounded-xl shadow-md shadow-blue-600/25 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Salvando...' : 'Salvar Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            className="bg-[#18181b] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="delete-dialog-title" className="text-base font-bold text-white">
                    Excluir Usuário
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Confirmação de remoção de membro
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingVendor(null)}
                disabled={isDeleting}
                className="text-zinc-500 hover:text-white p-1 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div id="delete-dialog-desc" className="space-y-2 text-xs text-zinc-300">
              <p>
                Tem certeza de que deseja excluir permanentemente o acesso de{' '}
                <strong className="text-white font-semibold">{deletingVendor.full_name}</strong>{' '}
                <span className="text-zinc-400 font-mono">({deletingVendor.email})</span>?
              </p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Se este usuário tiver propostas comerciais vinculadas, a exclusão será bloqueada para preservar o histórico. Nesses casos, recomendamos alterar o status para &quot;Inativo&quot;.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeletingVendor(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-md shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-60"
              >
                {isDeleting && (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{isDeleting ? 'Excluindo...' : 'Sim, excluir usuário'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
