import { diagnosticClient, runDiagnostic, signInForDiagnostic } from './diagnostic-common.mjs'

runDiagnostic(async () => {
  const client = diagnosticClient({ authenticated: true })
  const user = await signInForDiagnostic(client)
  const { data, error } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (error || !data) throw new Error('Perfil não disponível.')
  console.log('Perfil próprio acessível. Nenhum dado pessoal foi exibido.')
})
