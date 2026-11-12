// O teste antigo criava/emitia dados no banco configurado sem isolamento.
console.error('Teste remoto legado bloqueado. Use os testes locais e homologue o contrato RPC em ambiente descartável aprovado; consulte docs/OPERACAO-LOCAL.md.')
process.exitCode = 1
