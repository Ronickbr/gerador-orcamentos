import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Diagnósticos explícitos. Nunca imprime credenciais, tokens ou registros. */
export function diagnosticClient({ authenticated = false } = {}) {
  if (process.env.ORCAMENTO_ALLOW_DIAGNOSTICS !== 'yes') {
    throw new Error('Diagnóstico remoto bloqueado. Consulte docs/OPERACAO-LOCAL.md.')
  }
  const envPath = fileURLToPath(new URL('../.env.local', import.meta.url))
  if (existsSync(envPath)) process.loadEnvFile(envPath)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Configuração Supabase ausente.')
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('URL Supabase inválida.') }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('Supabase exige HTTPS, exceto em localhost.')
  }
  if (process.env.ORCAMENTO_DIAGNOSTICS_URL !== url) {
    throw new Error('Confirme explicitamente a URL de destino com ORCAMENTO_DIAGNOSTICS_URL.')
  }
  if (authenticated && (!process.env.ORCAMENTO_DIAGNOSTICS_EMAIL || !process.env.ORCAMENTO_DIAGNOSTICS_PASSWORD)) {
    throw new Error('Credenciais de diagnóstico devem ser fornecidas por variáveis de ambiente.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  })
}

export async function signInForDiagnostic(client) {
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.ORCAMENTO_DIAGNOSTICS_EMAIL,
    password: process.env.ORCAMENTO_DIAGNOSTICS_PASSWORD,
  })
  if (error || !data.user) throw new Error('Autenticação de diagnóstico falhou; verifique a configuração e os logs protegidos do serviço.')
  return data.user
}

export function runDiagnostic(task) {
  task().catch(() => {
    // Mensagens brutas de bibliotecas podem conter URLs ou conteúdo sensível.
    console.error('Diagnóstico não concluído. Verifique autorização explícita, configuração e acesso; nenhum detalhe sensível foi exibido.')
    process.exitCode = 1
  })
}
