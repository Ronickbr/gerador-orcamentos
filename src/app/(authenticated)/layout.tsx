import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { SignOutButton } from '@/components/sign-out-button'
import { measureAsync } from '@/lib/perf'
import type { Organization, Profile } from '@/types/database'

function BlockedAccess({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e10] p-6 text-zinc-100">
      <div className="max-w-md w-full bg-[#18181b] rounded-2xl border border-zinc-800 p-6 space-y-3 shadow-2xl">
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-sm text-zinc-400">{message}</p>
        <p className="text-xs text-zinc-500">
          O provisionamento é feito por um administrador ativo da sua organização.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <SignOutButton />
          <Link href="/login" className="text-sm font-semibold text-[#0072f5] hover:underline">
            Ir para o login
          </Link>
        </div>
      </div>
    </div>
  )
}

async function loadLayoutProfileData() {
  return measureAsync('loadLayoutProfileData', async () => {
    const supabase = await createClient()

    const {
      data: { user },
    } = await getAuthenticatedUser()

    if (!user) {
      return { user: null, profile: null, organization: null }
    }

    // Consulta combinada com join: busca profile e organization em uma única ida à rede
    const { data: profileWithOrg } = await supabase
      .from('profiles')
      .select('*, organization:organizations(*)')
      .eq('id', user.id)
      .single()

    let profile: Profile | null = null
    let organization: Organization | null = null

    if (profileWithOrg) {
      const raw = profileWithOrg as Profile & { organization?: Organization | null }
      organization = raw.organization ?? null
      profile = {
        id: raw.id,
        organization_id: raw.organization_id,
        full_name: raw.full_name,
        email: raw.email,
        phone: raw.phone,
        role: raw.role,
        active: raw.active,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      }
    }

    // Fallback seguro caso o join do PostgREST não retorne a organização
    if (profile && !organization) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single()
      organization = (orgData as Organization | null) ?? null
    }

    return { user, profile, organization }
  })
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { result } = await loadLayoutProfileData()
  const { user, profile, organization } = result

  if (!user) {
    redirect('/login')
  }

  if (!profile) {
    return (
      <BlockedAccess
        title="Perfil não provisionado"
        message="Sua conta existe no Auth, mas não está vinculada a nenhuma organização."
      />
    )
  }

  if (!profile.active) {
    return (
      <BlockedAccess
        title="Acesso inativo"
        message="Seu usuário foi desativado e não pode criar nem emitir orçamentos."
      />
    )
  }

  return (
    <AuthenticatedShell profile={profile} organization={organization}>
      {children}
    </AuthenticatedShell>
  )
}
