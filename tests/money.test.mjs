import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './_load-ts.mjs'

const { parseCurrencyToCents, formatCurrency, parseQuantity, formatQuantity, deriveQuoteStatus } =
  loadTs('src/lib/utils.ts')

const norm = (s) => s.replace(/\u00a0/g, ' ')

test('formatCurrency: centavos -> BRL pt-BR', () => {
  assert.equal(norm(formatCurrency(0)), 'R$ 0,00')
  assert.equal(norm(formatCurrency(1)), 'R$ 0,01')
  assert.equal(norm(formatCurrency(123456)), 'R$ 1.234,56')
  assert.equal(norm(formatCurrency(100000000)), 'R$ 1.000.000,00')
  assert.equal(norm(formatCurrency(NaN)), 'R$ 0,00')
})

test('parseCurrencyToCents: entrada numérica em reais', () => {
  assert.equal(parseCurrencyToCents(0), 0)
  assert.equal(parseCurrencyToCents(1), 100)
  assert.equal(parseCurrencyToCents(10.5), 1050)
  assert.equal(parseCurrencyToCents(0.01), 1)
  assert.equal(parseCurrencyToCents(NaN), 0)
})

test('parseCurrencyToCents: formatos pt-BR e en-US', () => {
  assert.equal(parseCurrencyToCents('R$ 1.234,56'), 123456)
  assert.equal(parseCurrencyToCents('1.234,56'), 123456)
  assert.equal(parseCurrencyToCents('1234,56'), 123456)
  assert.equal(parseCurrencyToCents('1,234.56'), 123456)
  assert.equal(parseCurrencyToCents('1234.56'), 123456)
  assert.equal(parseCurrencyToCents('12,5'), 1250)
  assert.equal(parseCurrencyToCents('1.234'), 123400)
  assert.equal(parseCurrencyToCents('-10,50'), -1050)
})

test('parseCurrencyToCents: entrada inválida não vira valor absurdo', () => {
  assert.equal(parseCurrencyToCents(''), 0)
  assert.equal(parseCurrencyToCents('abc'), 0)
  assert.equal(parseCurrencyToCents('R$'), 0)
})

test('parseQuantity: aceita decimais com vírgula e ponto', () => {
  assert.equal(parseQuantity('1,5'), 1.5)
  assert.equal(parseQuantity('2.25'), 2.25)
  assert.equal(parseQuantity(3), 3)
  assert.equal(Number.isNaN(parseQuantity('abc')), true)
  assert.equal(Number.isNaN(parseQuantity('')), true)
  assert.equal(Number.isNaN(parseQuantity('1,2,3')), true)
})

test('formatQuantity: exibe decimal pt-BR sem zeros inúteis', () => {
  assert.equal(formatQuantity(1.5), '1,5')
  assert.equal(formatQuantity(2), '2')
  assert.equal(formatQuantity('2,25'), '2,25')
})

test('deriveQuoteStatus: expired só é derivado de issued vencido', () => {
  const past = new Date(Date.now() - 86400000).toISOString()
  const future = new Date(Date.now() + 86400000).toISOString()
  assert.equal(deriveQuoteStatus({ status: 'issued', valid_until: past }), 'expired')
  assert.equal(deriveQuoteStatus({ status: 'issued', valid_until: future }), 'issued')
  assert.equal(deriveQuoteStatus({ status: 'draft', valid_until: past }), 'draft')
  assert.equal(deriveQuoteStatus({ status: 'cancelled', valid_until: past }), 'cancelled')
  assert.equal(deriveQuoteStatus({ status: 'issued', valid_until: null }), 'issued')
})
