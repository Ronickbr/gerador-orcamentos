# Gerador de orçamentos

Aplicação em Next.js, React, TypeScript e Supabase para preparar propostas comerciais.

## Estado e limites

A revisão técnica de 11/11/2026 identificou pendências de autorização no banco, integridade da gravação, administração e impressão. As correções locais precisam de testes e homologação antes de publicação. A presença de arquivos SQL não comprova que o banco ativo possui essas regras.

Os documentos em `docs/PRD.md` e `docs/ESPECIFICACAO-TECNICA.md` descrevem requisitos, não um certificado de implementação. PDF arquivado em armazenamento privado, paginação correta e recuperação de acesso precisam de confirmação no fluxo final; não presuma que `window.print()` arquiva um documento.

## Ambiente

- Node.js >=22.13.0 (ambiente auditado: 24.22.1).
- npm >=11 (gerenciador de referência: 11.19.1).
- `package-lock.json` é o lockfile adotado. Os arquivos pnpm permanecem apenas como legado, não devem ser usados para instalar esta aplicação.
- A aplicação usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`.
- Chaves administrativas nunca devem usar prefixo `NEXT_PUBLIC_`.

Não compartilhe `.env` ou `.env.local`. Não use contas ou dados de produção em testes.

## Comandos

Os comandos abaixo são instruções para o operador; nenhuma instalação ou publicação foi realizada durante a correção dos scripts.

```powershell
npm ci
npm run typecheck
npm run lint
npm run dev
```

`npm test` executa a suíte local de lógica em memória, sem rede nem banco. `npm run check` combina TypeScript sem emissão de arquivos, lint e esses testes. `npm run build` gera artefatos locais e deve ser executado apenas quando esse passo estiver autorizado. O resultado de lint, TypeScript ou testes locais não substitui testes de autorização e persistência em ambiente descartável.

## Banco e operação

Leia [Operação local e homologação](docs/OPERACAO-LOCAL.md). Não execute os SQL de reparo, seed ou limpeza como uma sequência de instalação. Revise o schema e as migrations finais, faça backup e obtenha aprovação antes de aplicá-los ao ambiente ativo.

Scripts antigos de cadastro de administrador e emissão de teste foram bloqueados: eles usavam credenciais fixas ou alteravam dados sem isolamento. Diagnósticos remotos exigem liberação explícita e não exibem tokens ou registros.
