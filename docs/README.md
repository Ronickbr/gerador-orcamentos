# Documentação Oficial do Sistema de Orçamentos

Este diretório contém a documentação técnica, funcional e de design que serve como a **única fonte de verdade (*single source of truth*)** para o projeto **Gerador de Orçamentos**.

---

## Os 6 Documentos Fundamentais de Arquitetura

Conforme as diretrizes obrigatórias de desenvolvimento, o sistema é estruturado através dos 6 documentos principais abaixo:

| # | Documento | Arquivo | Descrição |
| :-: | :--- | :--- | :--- |
| **1** | **PRD** | [1-PRD.md](./1-PRD.md) | Documento de Requisitos do Produto: visão geral, personas, proposta de valor, requisitos funcionais, não-funcionais e métricas de sucesso (KPIs). |
| **2** | **TRD** | [2-TRD.md](./2-TRD.md) | Documento de Requisitos Técnicos: stack tecnológica justificada (Next.js 16, React 19, Supabase, Tailwind v4), padrões arquiteturais, segurança, RBAC e esteira de CI/CD. |
| **3** | **Fluxo do App** | [3-FLUXO-DO-APP.md](./3-FLUXO-DO-APP.md) | Jornadas do usuário (vendedor e administrador), mapa de rotas (sitemap), diagrama de transição de estados do orçamento e tratamento de casos de borda. |
| **4** | **Briefing de Design** | [4-BRIEFING-DE-DESIGN.md](./4-BRIEFING-DE-DESIGN.md) | Diretrizes visuais (Clean B2B SaaS), paleta de cores e tokens semânticos, tipografia, design system (CurrencyInput, formulário dinâmico) e regras de impressão (@media print / A4). |
| **5** | **Esquema do Back-end** | [5-ESQUEMA-DO-BACKEND.md](./5-ESQUEMA-DO-BACKEND.md) | Modelagem ER, tabelas relacionais do PostgreSQL, view pública `quote_list`, catálogo de RPCs transacionais atômicas (`save_quote_draft`, `issue_quote`, `cancel_quote`) e políticas RLS. |
| **6** | **Plano de Implementação** | [6-PLANO-DE-IMPLEMENTACAO.md](./6-PLANO-DE-IMPLEMENTACAO.md) | Divisão de fases/sprints, status atual das entregas, estratégia de testes automatizados (`npm run check`) e roteiro operacional para homologação e go-live. |

---

## Documentos Operacionais Complementares

- [Operação Local e Homologação](./OPERACAO-LOCAL.md) — Roteiro de configuração de ambiente de desenvolvimento e aplicação segura de migrations.
- [Operação, Segurança e Lançamento](./OPERACAO-E-SEGURANCA.md) — Diretrizes de proteção de credenciais e checklists operacionais.
