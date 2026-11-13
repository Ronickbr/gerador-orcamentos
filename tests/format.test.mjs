import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './_load-ts.mjs'

const { formatDate, formatDateTime, parseStoreAddress } = loadTs('src/lib/utils.ts')

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

test('parseStoreAddress: divide endereço em 3 linhas (rua/bairro, município/UF, CEP)', () => {
  const parsed = parseStoreAddress('Marechal Floriano Peixoto, 1780, CEP 80230-110, Rebouças, Curitiba - PR')
  assert.equal(parsed.street, 'Marechal Floriano Peixoto, 1780, Rebouças')
  assert.equal(parsed.cityState, 'Curitiba, PR')
  assert.equal(parsed.cep, 'CEP 80230-110')
})

test('parseStoreAddress: suporta quebras de linha explicitas', () => {
  const parsed = parseStoreAddress('Rua Marechal Floriano Peixoto, 1780 - Rebouças\nCuritiba, PR\n80230-110')
  assert.equal(parsed.street, 'Rua Marechal Floriano Peixoto, 1780 - Rebouças')
  assert.equal(parsed.cityState, 'Curitiba, PR')
  assert.equal(parsed.cep, 'CEP 80230-110')
})

test('parseStoreAddress: retorna fallback padrão se vazio', () => {
  const parsed = parseStoreAddress(null)
  assert.equal(parsed.street, 'Av. Mal. Floriano Peixoto, 1780 - Rebouças')
  assert.equal(parsed.cityState, 'Curitiba, PR')
  assert.equal(parsed.cep, 'CEP 80230-110')
})
