import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

/**
 * Cliente Supabase server-side com memoização por requisição (React.cache).
 * Garante que chamadas no mesmo ciclo de renderização não recriem o cliente.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
})

/**
 * Obtém o usuário autenticado com cache na mesma requisição (React.cache).
 * Evita múltiplas chamadas remotas de rede para supabase.auth.getUser()
 * quando layout, páginas ou server actions são avaliados na mesma requisição.
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  return await supabase.auth.getUser()
})
