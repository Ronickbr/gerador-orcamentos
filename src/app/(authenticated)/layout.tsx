import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app-sidebar'
import { SignOutButton } from '@/components/sign-out-button'
import { measureAsync } from '@/lib/perf'
import type { Organization, Profile } from '@/types/database'

function BlockedAccess({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-amber-200 p-6 space-y-3">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{message}</p>
        <p className="text-xs text-slate-500">
          O provisionamento é feito por um administrador ativo da sua organização.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <SignOutButton />
          <Link href="/login" className="text-sm font-semibold text-blue-700 hover:underline">
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
    <div className="min-h-screen bg-slate-50 print:bg-white print:min-h-0 print:block">
      <AppSidebar profile={profile} organization={organization} />
      <div className="lg:pl-64 flex flex-col min-h-screen min-w-0 print:pl-0">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
          {children}
        </main>
      </div>
    </div>
  )
}
