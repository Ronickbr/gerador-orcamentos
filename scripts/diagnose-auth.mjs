import { diagnosticClient, runDiagnostic, signInForDiagnostic } from './diagnostic-common.mjs'

runDiagnostic(async () => {
  const client = diagnosticClient({ authenticated: true })
  await signInForDiagnostic(client)
  console.log('Autenticação de diagnóstico concluída. Nenhum token ou dado pessoal foi exibido.')
})
