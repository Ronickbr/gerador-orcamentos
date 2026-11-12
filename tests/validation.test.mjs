import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './_load-ts.mjs'

const {
  emptyItem,
  lineTotalCents,
  itemsSubtotalCents,
  validateQuoteForm,
} = loadTs('src/lib/validation.ts')

function baseForm(overrides = {}) {
  return {
    customerName: 'Cliente Teste',
    customerPhone: '',
    customerEmail: '',
    customerTaxId: '',
    paymentTerms: '',
    notes: '',
    validityDays: '',
    discountCents: 0,
    items: [
      { key: 'i1', description: 'Serviço', quantity: '1', unit: 'un', unitPriceCents: 10000 },
    ],
    ...overrides,
  }
}

test('lineTotalCents: quantidade decimal com vírgula não truncada', () => {
  assert.equal(lineTotalCents({ ...emptyItem('a'), description: 'x', quantity: '1,5', unitPriceCents: 1000 }), 1500)
  assert.equal(lineTotalCents({ ...emptyItem('a'), description: 'x', quantity: '2.25', unitPriceCents: 1000 }), 2250)
  assert.equal(lineTotalCents({ ...emptyItem('a'), description: 'x', quantity: '0', unitPriceCents: 1000 }), 0)
})

test('itemsSubtotalCents: soma linhas com arredondamento por linha', () => {
  assert.equal(
    itemsSubtotalCents([
      { ...emptyItem('a'), description: 'A', quantity: '1', unitPriceCents: 999 },
      { ...emptyItem('b'), description: 'B', quantity: '1,333', unitPriceCents: 999 },
    ]),
    999 + Math.round(1.333 * 999)
  )
})

test('validateQuoteForm: payload válido sem totais calculados pelo cliente', () => {
  const result = validateQuoteForm(baseForm({ customerEmail: 'A@B.COM' }))
  assert.equal(result.ok, true)
  assert.equal(result.payload.customer_email, 'a@b.com')
  assert.deepEqual(result.payload.items, [
    { description: 'Serviço', quantity: 1, unit: 'un', unit_price_cents: 10000 },
  ])
  assert.equal(result.subtotalCents, 10000)
  assert.equal('subtotal_cents' in result.payload, false)
  assert.equal('total_cents' in result.payload, false)
})

test('validateQuoteForm: quantidade decimal vira número no payload', () => {
  const result = validateQuoteForm(
    baseForm({ items: [{ key: 'i1', description: 'Horas', quantity: '2,5', unit: 'h', unitPriceCents: 8000 }] })
  )
  assert.equal(result.ok, true)
  assert.equal(result.payload.items[0].quantity, 2.5)
  assert.equal(result.subtotalCents, 20000)
})

test('validateQuoteForm: item inválido é reportado, não descartado em silêncio', () => {
  const result = validateQuoteForm(
    baseForm({
      items: [
        { key: 'ok', description: 'Válido', quantity: '1', unit: 'un', unitPriceCents: 500 },
        { key: 'qtd', description: 'Inválido', quantity: '0', unit: 'un', unitPriceCents: 500 },
        { key: 'desc', description: '   ', quantity: '1', unit: 'un', unitPriceCents: 500 },
      ],
    })
  )
  assert.equal(result.ok, false)
  assert.equal(result.itemErrors.qtd, 'Quantidade deve ser maior que zero.')
  assert.equal(result.itemErrors.desc, 'Informe a descrição.')
  assert.match(result.error, /2 item\(ns\)/)
})

test('validateQuoteForm: rejeita e-mail inválido e validade fora de 1..365', () => {
  assert.equal(validateQuoteForm(baseForm({ customerEmail: 'invalido' })).ok, false)
  assert.equal(validateQuoteForm(baseForm({ validityDays: '0' })).ok, false)
  assert.equal(validateQuoteForm(baseForm({ validityDays: '366' })).ok, false)
  assert.equal(validateQuoteForm(baseForm({ validityDays: '15' })).payload.validity_days, 15)
})

test('validateQuoteForm: desconto negativo é normalizado para zero', () => {
  const result = validateQuoteForm(baseForm({ discountCents: -500 }))
  assert.equal(result.ok, true)
  assert.equal(result.payload.discount_cents, 0)
})
