import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logPerf } from '@/lib/perf'

export async function updateSession(request: NextRequest) {
  const start = performance.now()
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')
  const isAuthCallback = pathname.startsWith('/auth')
  // Sessão de recuperação precisa permanecer no /login para definir a nova senha.
  const isRecovery = request.nextUrl.searchParams.get('reset') === '1'
  const isPublicAsset = 
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')

  const duration = performance.now() - start
  logPerf('proxy.ts', duration, { method: request.method, path: pathname, authed: Boolean(user) })

  // Define Server-Timing para inspeção em DevTools/benchmarks
  supabaseResponse.headers.set('Server-Timing', `middleware;dur=${duration.toFixed(1)};desc="proxy.ts"`)

  if (!user && !isLoginPage && !isAuthCallback && !isPublicAsset) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage && !isRecovery) {
    const url = request.nextUrl.clone()
    url.pathname = '/orcamentos'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
