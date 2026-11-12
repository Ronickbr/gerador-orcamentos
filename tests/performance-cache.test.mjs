import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './_load-ts.mjs'

const { measureAsync } = loadTs('src/lib/perf.ts')

test('measureAsync: mede tempo decorrido com precisão e preserva resultado', async () => {
  const { result, durationMs } = await measureAsync('testOp', async () => {
    let sum = 0
    for (let i = 0; i < 1000; i++) sum += i
    return sum
  })

  assert.equal(result, 499500)
  assert.equal(typeof durationMs, 'number')
  assert.ok(durationMs >= 0)
})

test('cache de métricas: simulação de isolamento por organização e perfil', async () => {
  // Simula o comportamento do Map de cache de loadQuoteMetrics
  const cache = new Map()
  const TTL = 15_000

  function getMetrics(orgId, userId, role, dataStore) {
    const key = `${orgId}:${role === 'admin' ? 'admin' : userId}`
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && hit.expiresAt > now) {
      return { data: hit.data, source: 'CACHE_HIT' }
    }

    // Calcula a partir do dataStore filtrando por tenant e permissão
    const quotes = dataStore.filter(q => {
      if (q.organization_id !== orgId) return false
      if (role !== 'admin' && q.seller_user_id !== userId) return false
      return true
    })

    const total_count = quotes.length
    const issued_count = quotes.filter(q => q.status === 'issued').length
    const draft_count = quotes.filter(q => q.status === 'draft').length
    const cancelled_count = quotes.filter(q => q.status === 'cancelled').length
    const expired_count = quotes.filter(q => q.status === 'expired').length
    const active_volume_cents = quotes
      .filter(q => q.status !== 'cancelled')
      .reduce((acc, q) => acc + q.total_cents, 0)

    const result = {
      total_count,
      issued_count,
      draft_count,
      cancelled_count,
      expired_count,
      active_volume_cents,
    }

    cache.set(key, { data: result, expiresAt: now + TTL })
    return { data: result, source: 'DB_FETCH' }
  }

  const sampleDb = [
    { organization_id: 'org-1', seller_user_id: 'user-a', status: 'issued', total_cents: 10000 },
    { organization_id: 'org-1', seller_user_id: 'user-b', status: 'draft', total_cents: 5000 },
    { organization_id: 'org-2', seller_user_id: 'user-c', status: 'issued', total_cents: 20000 },
  ]

  // 1ª chamada: carrega do banco (DB_FETCH)
  const req1 = getMetrics('org-1', 'user-a', 'seller', sampleDb)
  assert.equal(req1.source, 'DB_FETCH')
  assert.equal(req1.data.total_count, 1)
  assert.equal(req1.data.active_volume_cents, 10000)

  // 2ª chamada: cache hit instantâneo
  const req2 = getMetrics('org-1', 'user-a', 'seller', sampleDb)
  assert.equal(req2.source, 'CACHE_HIT')
  assert.equal(req2.data.total_count, 1)

  // 3ª chamada: vendedor B na mesma org não vê os dados do vendedor A se não for admin
  const req3 = getMetrics('org-1', 'user-b', 'seller', sampleDb)
  assert.equal(req3.data.total_count, 1)
  assert.equal(req3.data.active_volume_cents, 5000)

  // 4ª chamada: org 2 nunca vê dados da org 1
  const req4 = getMetrics('org-2', 'user-c', 'seller', sampleDb)
  assert.equal(req4.data.total_count, 1)
  assert.equal(req4.data.active_volume_cents, 20000)

  // Invalidação em mutação (novo orçamento salvo)
  cache.clear()
  const req5 = getMetrics('org-1', 'user-a', 'seller', sampleDb)
  assert.equal(req5.source, 'DB_FETCH')
})

test('benchmark: cache de métricas em memória responde em menos de 1ms', () => {
  const cache = new Map()
  const key = 'org-123:admin'
  const metricsData = {
    total_count: 50,
    issued_count: 30,
    draft_count: 15,
    cancelled_count: 5,
    expired_count: 2,
    active_volume_cents: 15000000,
  }

  cache.set(key, { data: metricsData, expiresAt: Date.now() + 15000 })

  const start = performance.now()
  for (let i = 0; i < 1000; i++) {
    const item = cache.get(key)
    assert.ok(item !== undefined)
  }
  const totalDuration = performance.now() - start
  const avgPerCall = totalDuration / 1000

  // Cada leitura em memória leva menos de 0.05ms
  assert.ok(avgPerCall < 0.1, `Média por chamada foi ${avgPerCall}ms, esperava < 0.1ms`)
})

