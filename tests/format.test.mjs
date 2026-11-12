import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './_load-ts.mjs'

const { formatDate, formatDateTime } = loadTs('src/lib/utils.ts')

test('formatDate: string ISO respeita America/Sao_Paulo', () => {
  // 03:00Z = 00:00 em São Paulo (UTC-3, sem DST desde 2019).
  assert.equal(formatDate('2026-11-11T03:00:00Z'), '11/11/2026')
  // 02:59Z ainda é 10/11 em São Paulo.
  assert.equal(formatDate('2026-11-11T02:59:00Z'), '10/11/2026')
})

test('formatDate: aceita objeto Date', () => {
  assert.equal(formatDate(new Date('2026-01-01T15:00:00Z')), '01/01/2026')
})

test('formatDateTime: data e hora em pt-BR e fuso de São Paulo', () => {
  const out = formatDateTime('2026-11-11T03:00:00Z')
  assert.match(out, /^11\/11\/2026,?\s+00:00/)
})
