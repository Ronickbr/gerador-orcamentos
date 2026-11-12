import { diagnosticClient, runDiagnostic } from './diagnostic-common.mjs'

runDiagnostic(async () => {
  const client = diagnosticClient()
  const { error } = await client.from('organizations').select('id', { head: true }).limit(1)
  if (error) throw new Error('Consulta de diagnóstico falhou.')
  console.log('API respondeu à consulta anônima. Isso não comprova existência de registros nem correção da RLS.')
})
