// Guardas estáticas da migration (não executam banco).
// Verificam invariantes de privilégio e o desconto no INSERT de save_quote_draft.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261111153000_security_and_integrity_hardening.sql'),
  'utf8'
)

test('migration: nenhum GRANT para anon ou public', () => {
  const grantees = [...sql.matchAll(/\bgrant\s+[^;]*?\bto\s+([^;]+);/gi)].flatMap((m) =>
    m[1].split(',').map((role) => role.trim().toLowerCase())
  )
  assert.ok(grantees.length > 0)
  assert.deepEqual(grantees.filter((role) => role === 'anon' || role === 'public'), [])
})

test('migration: revoga EXECUTE herdado e default privileges', () => {
  assert.match(sql, /revoke all on all routines in schema public from public, anon/i)
  assert.match(
    sql,
    /alter default privileges in schema public revoke execute on functions from public, anon/i
  )
})

test('migration: toda RPC (não-trigger) recebe GRANT explícito para authenticated', () => {
  const rpcs = sql
    .split(/create or replace function public\./i)
    .slice(1)
    .map((segment) => segment.match(/^(\w+)\(([\s\S]*?)\)\s*returns\s+(\w+)/i))
    .filter((m) => m && m[3].toLowerCase() !== 'trigger')
    .map((m) => m[1])
  assert.ok(rpcs.length >= 10, `esperava >=10 RPCs, achei ${rpcs.length}`)
  for (const name of new Set(rpcs)) {
    assert.match(
      sql,
      new RegExp(`grant execute on function public\\.${name}\\(`, 'i'),
      `função ${name} sem grant explícito`
    )
  }
})

test('migration: INSERT de save_quote_draft grava discount_cents', () => {
  const fn = sql.slice(sql.indexOf('function public.save_quote_draft'))
  const block = fn.match(
    /insert into public\.quotes \(([\s\S]*?)\) values \(([\s\S]*?)\)\s+returning \* into v_quote/
  )
  assert.ok(block, 'INSERT de save_quote_draft não encontrado')
  assert.match(block[1], /discount_cents/i, 'coluna discount_cents ausente')
  assert.match(block[2], /discount_cents/i, 'valor de discount_cents ausente')
})
