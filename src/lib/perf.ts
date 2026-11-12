/**
 * Utilitário de instrumentação e medição de performance para rotas e actions.
 * Não registra tokens, credenciais, cookies ou dados sensíveis.
 */

const IS_DEV = process.env.NODE_ENV !== 'production'
const DEBUG_PERF = process.env.DEBUG_PERF === 'true'

export function logPerf(tag: string, durationMs: number, meta?: Record<string, string | number | boolean | null | undefined>): void {
  if (!IS_DEV && !DEBUG_PERF) return

  const metaStr = meta
    ? ' ' + Object.entries(meta)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : ''

  console.log(`[PERF][${tag}] ${durationMs.toFixed(1)}ms${metaStr}`)
}

export async function measureAsync<T>(
  tag: string,
  fn: () => Promise<T>,
  meta?: Record<string, string | number | boolean | null | undefined>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  try {
    const result = await fn()
    const durationMs = performance.now() - start
    logPerf(tag, durationMs, meta)
    return { result, durationMs }
  } catch (error) {
    const durationMs = performance.now() - start
    logPerf(tag, durationMs, { ...meta, error: true })
    throw error
  }
}

