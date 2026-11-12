# Gerador de orçamentos

> Aplicação web em **Next.js, React, TypeScript e Supabase** para vendedores autenticados prepararem orçamentos comerciais com papel timbrado da empresa, dados do vendedor preenchidos automaticamente e geração de PDF pronto para compartilhar.

[![Estrelas](https://img.shields.io/github/stars/Ronickbr/gerador-orcamentos?style=social)](https://github.com/Ronickbr/gerador-orcamentos/stargazers)
[![Forks](https://img.shields.io/github/forks/Ronickbr/gerador-orcamentos?style=social)](https://github.com/Ronickbr/gerador-orcamentos/network/members)
[![Issues](https://img.shields.io/github/issues/Ronickbr/gerador-orcamentos)](https://github.com/Ronickbr/gerador-orcamentos/issues)
[![Último commit](https://img.shields.io/github/last-commit/Ronickbr/gerador-orcamentos)](https://github.com/Ronickbr/gerador-orcamentos/commits/main)

## Sobre

O Gerador de orçamentos padroniza a criação de propostas comerciais, eliminando a edição manual de documentos e o risco de dados inconsistentes. Um vendedor autenticado informa o cliente e os itens (descrição, quantidade, preço unitário); o sistema calcula subtotais e total em BRL, associa automaticamente nome e telefone do vendedor da conta logada e aplica o papel timbrado configurado pela administração. O resultado é um documento com identidade visual consistente, visualizável, baixável como PDF e arquivado no histórico.

**Para quem é:** times comerciais que precisam emitir orçamentos profissionais, rastreáveis e vinculados ao vendedor responsável, sem depender de planilhas ou editores de texto.

**Stack principal:** Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase (autenticação, banco relacional com RLS e storage privado de PDFs).

**Diferenciais:** cálculo de valores em centavos (sem erro de ponto flutuante), snapshot dos dados do vendedor no momento da emissão, número único de orçamento, ciclo de vida (Rascunho → Emitido → Cancelado/Expirado), histórico consultável e área administrativa para configurar equipe e identidade visual.

## Demonstração

Adicione um screenshot ou GIF curto em `assets/preview.png` mostrando o formulário de orçamento e o PDF gerado. Enquanto não há imagem publicada, a prévia da aplicação está disponível rodando localmente com `npm run dev`.

## Instalação

```bash
# Clone o repositório
git clone https://github.com/Ronickbr/gerador-orcamentos.git
cd gerador-orcamentos

# Instale dependências com npm (lockfile oficial: package-lock.json)
npm ci

# Copie o exemplo de ambiente
cp .env.example .env.local

# Edite .env.local com a URL e a chave anônima do seu projeto Supabase.
# Nunca comite .env.local nem use credenciais de produção em testes.

# Rode em desenvolvimento
npm run dev
```

Abra http://localhost:3000.

## Stack e decisões técnicas

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, date-fns.
- **Backend/Banco:** Supabase (Auth, Postgres com RLS, server actions, storage privado para PDFs).
- **Gerenciador de pacotes:** npm — `package-lock.json` é o lockfile adotado. Os arquivos `pnpm-lock.yaml` e `pnpm-workspace.yaml` permanecem como legado e não devem ser usados para instalar a aplicação.
- **Motores:** Node.js >= 22.13.0, npm >= 11.

## Uso

1. Entre com credenciais individuais (login obrigatório).
2. Abra **Novo orçamento**.
3. Preencha nome do cliente (obrigatório) e, opcionalmente, telefone, e-mail, documento fiscal e observações.
4. Adicione um ou mais itens com descrição, quantidade e preço unitário; subtotal e total são calculados automaticamente.
5. Confira a prévia com o papel timbrado e os dados do vendedor já preenchidos.
6. Salve como rascunho ou **emita** o orçamento: gera número único, congela os dados do vendedor e produz o PDF.
7. Baixe o PDF ou reabra o orçamento emitido pelo histórico. O registro fica arquivado; correções geram nova versão ou novo documento, nunca sobrescrita silenciosa.

Área administrativa (usuários com papel `admin`): cadastra/desativa vendedores e edita identidade visual (logotipo, nome empresarial, contatos institucionais) sem alterar documentos já emitidos.

Mais detalhes: `docs/PRD.md` (requisitos) e `docs/ESPECIFICACAO-TECNICA.md` (modelo de dados, API, geração de PDF).

## Estado e limites

A revisão técnica de 11/11/2026 identificou pendências de autorização no banco, integridade da gravação, administração e impressão. As correções locais precisam de testes e homologação antes de publicação. A presença de arquivos SQL não comprova que o banco ativo possui essas regras.

Os documentos em `docs/PRD.md` e `docs/ESPECIFICACAO-TECNICA.md` descrevem requisitos, não um certificado de implementação. PDF arquivado em armazenamento privado, paginação correta e recuperação de acesso precisam de confirmação no fluxo final; não presuma que `window.print()` arquiva um documento.

Não execute os SQL de reparo, seed ou limpeza como sequência de instalação. Revise o schema e as migrations finais, faça backup e obtenha aprovação antes de aplicá-los ao ambiente ativo.

Scripts antigos de cadastro de administrador e emissão de teste foram bloqueados (encerram com código 1, sem rede nem banco).

## Ambiente

- Node.js >= 22.13.0 (ambiente auditado: 24.22.1).
- npm >= 11 (gerenciador de referência: 11.19.1).
- `package-lock.json` é o lockfile adotado.
- A aplicação usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`.
- Chaves administrativas nunca devem usar prefixo `NEXT_PUBLIC_` (ex.: `SUPABASE_SERVICE_ROLE_KEY` somente no servidor).

Não compartilhe `.env` nem `.env.local`. Não use contas ou dados de produção em testes.

## Comandos

Os comandos abaixo são instruções para o operador; nenhuma instalação ou publicação foi realizada durante a correção dos scripts.

```bash
npm ci
npm run typecheck
npm run lint
npm run dev
```

- `npm test` — suíte local de lógica em memória, sem rede nem banco.
- `npm run check` — TypeScript sem emissão, lint e testes locais.
- `npm run build` — gera artefatos locais; execute apenas quando autorizado.

O resultado de lint, TypeScript ou testes locais não substitui testes de autorização e persistência em ambiente descartável.

## Banco e operação

Leia [Operação local e homologação](docs/OPERACAO-LOCAL.md). Não execute os SQL de reparo, seed ou limpeza como sequência de instalação. Revise o schema e as migrations finais, faça backup e obtenha aprovação antes de aplicá-los ao ambiente ativo.

A migration local `supabase/migrations/20261111153000_security_and_integrity_hardening.sql` **não foi aplicada** nesta tarefa; a aplicação depende da revisão e aplicação coordenada desse contrato.

## Contribuindo

1. Faça um fork do projeto.
2. Crie uma branch (`git checkout -b feature/minha-feature`).
3. Commit suas mudanças (`git commit -m 'feat: adiciona X'`).
4. Envie para a branch (`git push origin feature/minha-feature`).
5. Abra um Pull Request.

Leia o `CONTRIBUTING.md` para regras detalhadas, se existir.

## Licença

Repositório privado. Sem licença pública definida.

## Contato

Ronick AcidRed — [@Ronickbr](https://github.com/Ronickbr)  
Link do projeto: [https://github.com/Ronickbr/gerador-orcamentos](https://github.com/Ronickbr/gerador-orcamentos)

---

*README alinhado ao template profissional do segundo cérebro (vault Obsidian, modelo LLM Wiki).*
