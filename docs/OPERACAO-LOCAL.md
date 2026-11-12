# Operação local e homologação

## Escopo da revisão de scripts e configuração

Em 11/11/2026 os scripts JavaScript legados foram protegidos. Senhas fixas e impressão de respostas completas de autenticação foram removidas. As versões instaladas dos pacotes não foram alteradas. Nenhuma migração, instalação, publicação, login real ou alteração de banco foi executada nessa revisão.

As mudanças de aplicação e SQL são uma entrega separada e exigem revisão integrada. Não use esta página como confirmação de que o banco em produção foi corrigido.

## Instalação reproduzível

Use npm e `package-lock.json`. `pnpm-lock.yaml` contém somente o gerenciador, sem as dependências da aplicação, e fica preservado como legado. `pnpm-workspace.yaml` também é legado. Não misture gerenciadores.

Node >=22.13.0 e npm >=11 são declarados no manifesto. As dependências já instaladas continuam iguais às do lockfile; somente metadados de engine foram alinhados. TypeScript pode ser executado com `npm run typecheck`, sem gerar `.tsbuildinfo`.

A consulta ao registro npm em 11/11/2026 encontrou o advisory moderado GHSA-g3hv-75wg-m249 em minimatch 10.2.6, transitivo de desenvolvimento via @typescript-eslint/typescript-estree. Atualização/override precisa de avaliação de compatibilidade e autorização para instalar pacotes. Não aplique override de versão principal sem testes.

## Scripts bloqueados

Os seguintes comandos agora encerram com código 1, sem acessar rede ou alterar dados:

- `scripts/create-admin.mjs`
- `scripts/register-admin-official.mjs`
- `scripts/register-clean-admin.mjs`
- `scripts/setup-profile-for-admin.mjs`
- `scripts/diagnose-signup.mjs`
- `scripts/test-issue-quote.mjs`

O provisionamento inicial exige procedimento administrativo revisado e autorizado. O antigo teste de emissão não é uma suíte segura: criava rascunhos, itens e números oficiais no banco configurado. Deve ser substituído por testes contra ambiente descartável, adaptados ao contrato RPC final. Não reative esses scripts para contornar um problema de permissão.

## Diagnósticos remotos opcionais

Antes de qualquer diagnóstico, confirme o ambiente e autorize a operação. Autenticar gera sessão e pode gerar eventos no provedor; não é uma inspeção puramente local.

Variáveis exigidas no processo:

- `ORCAMENTO_ALLOW_DIAGNOSTICS=yes`: liberação explícita.
- `ORCAMENTO_DIAGNOSTICS_URL`: deve corresponder exatamente ao destino `NEXT_PUBLIC_SUPABASE_URL`.
- `ORCAMENTO_DIAGNOSTICS_EMAIL` e `ORCAMENTO_DIAGNOSTICS_PASSWORD`: somente para diagnóstico autenticado; forneça por mecanismo seguro, nunca como argumento de linha de comando ou texto compartilhado.

Depois da liberação, o helper pode carregar `.env.local`. HTTPS é obrigatório fora de localhost. Há timeout por requisição; a sessão não é persistida pelo cliente de diagnóstico. Nenhum token, senha, registro ou resposta bruta é impresso. Erros terminam com código 1.

`diagnose-auth.mjs` e `diagnose-login-new.mjs` testam autenticação. `check-profile.mjs` verifica apenas a existência do perfil próprio. `diagnose-rest.mjs` e `diagnose-profiles.mjs` usam consultas HEAD anônimas, sem trazer registros: sucesso HTTP não comprova que a política de acesso está correta nem que existem dados.

## Preparação para homologação

1. Revisar a migration final e as permissões de tabelas/funções, incluindo organizações distintas e usuários inativos.
2. Fazer backup protegido de banco e arquivos, verificar restauração em ambiente separado e definir responsável pelo rollback.
3. Inventariar as políticas realmente instaladas: os scripts locais podem divergir do banco ativo.
4. Obter aprovação para aplicar migrations no ambiente de homologação; nunca executar scripts de limpeza sobre produção.
5. Configurar credenciais e nomes de variáveis do contrato final por secret manager. Não colocar chaves administrativas no navegador.
6. Rodar testes locais, lint e TypeScript. Depois validar transações, concorrência, bloqueio de acesso, numeração e documento de várias páginas em homologação.
7. Publicar somente com aprovação específica e registrar o que foi aplicado.

## Credenciais antigas e backups

Caso senhas fixas dos scripts antigos tenham sido utilizadas, substituir as credenciais e revisar sessões e logs no provedor com autorização. Apagar a senha do código não revoga credenciais existentes. Não inferir vazamento real sem evidência.

Backups de código anteriores às correções ainda podem conter essas senhas. Restrinja o acesso a esses backups e não publique seu conteúdo. Arquivos `.env` não devem ser incluídos em relatórios ou cópias compartilhadas.

## Pendências de integração

Atualizar esta documentação com nomes das migrations, contratos RPC, variáveis administrativas e comando da suíte de testes após as entregas DEV/QA. Nenhuma dessas integrações foi presumida na revisão dos scripts.

## Contratos locais recebidos para revisão

Os arquivos locais incluem a migration `supabase/migrations/20261111153000_security_and_integrity_hardening.sql`. Ela NÃO foi aplicada nesta tarefa. A aplicação nova depende da revisão e aplicação coordenada desse contrato: não publique o frontend contra o schema antigo.

Server actions usam `save_quote_draft` (rascunho transacional com versão e request id), `issue_quote` (ator da sessão, versão esperada), `cancel_quote`, `update_organization_settings`, `admin_provision_seller`, `admin_update_profile` e `quote_metrics`. A implementação e as assinaturas definitivas devem ser conferidas na migration antes de aplicação.

O cadastro administrativo requer `SUPABASE_SERVICE_ROLE_KEY` somente no servidor, além da URL Supabase. Nenhuma chave foi solicitada, lida ou configurada para essa funcionalidade nesta tarefa. A ausência dessa configuração deixa o cadastro indisponível; não use uma variável NEXT_PUBLIC para contornar isso.

A suíte QA local é executada por `npm test`, que descobre `tests/**/*.test.mjs`; `npm run check` combina tipos, lint e esses testes. São testes de lógica em memória, não de banco nem PDF. A revisão QA identificou desconto ausente no INSERT do rascunho e risco residual de corte no PDF, encaminhados ao DEV. As telas administrativas já passaram a importar server actions; a revisão final ainda precisa verificar o fluxo completo.

## Verificação local desta revisão

Executado em 11/11/2026, sem rede, sem instalação de pacotes e sem acesso a banco:

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado; apenas `.agents/**` (ferramentas externas) é ignorado.
- `npm test`: 17 testes aprovados.
- `npm run check`: aprovado de ponta a ponta.
- Scripts bloqueados e diagnóstico sem liberação: encerram com código 1, sem rede.
- `package-lock.json` é o lockfile de instalação; seus metadados de engine coincidem com `package.json`. Os arquivos pnpm permanecem como legado e não devem ser usados.
- `.env.example` é o único arquivo de ambiente versionável (placeholder); `.env` e `.env.local` são ignorados.

## Homologação e rollback

1. Antes de aplicar a migration `20261111153000_security_and_integrity_hardening.sql`, faça backup protegido do banco e dos arquivos (baseline local sem `.env`) e teste a restauração em ambiente separado.
2. Aplique a migration apenas em homologação aprovada; valide RLS, organizações distintas, usuários inativos e transações dos RPCs.
3. Publique o frontend somente depois do schema e das server actions homologados.
4. Rollback: restaurar o backup do banco no ponto anterior, republicar o artefato anterior da aplicação e conferir que os RPCs antigos continuam compatíveis. Nenhum rollback foi executado nesta revisão.
5. A suíte local não cobre autorização, persistência nem PDF; esses fluxos exigem teste manual ou automatizado em ambiente descartável.
