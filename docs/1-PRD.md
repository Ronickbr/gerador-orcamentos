# 1. PRD — Product Requirements Document
## Sistema Online de Geração de Orçamentos Comerciais

**Projeto:** Gerador de Orçamentos  
**Versão do Documento:** 2.0  
**Data:** 11/11/2026  
**Status:** Alinhado e Consolidado com a Aplicação  

---

## 1. Visão Geral e Propósito

### 1.1 Objetivo do Produto
Disponibilizar uma plataforma web profissional, ágil e segura para que empresas e suas equipes de vendas elaborem, gerenciem e emitam propostas comerciais em segundos, padronizando a comunicação visual com papel timbrado da organização e garantindo a rastreabilidade integral de cada orçamento emitido.

### 1.2 Problema Real Resolvido
- **Morosidade e Perda de Tempo:** Vendedores costumam gastar tempo excessivo editando planilhas, modelos Word/Canva ou montando orçamentos manualmente em PDFs.
- **Inconsistência de Marca:** Propostas criadas fora de padrão visual desvalorizam o serviço da empresa e transmitem falta de profissionalismo.
- **Erros de Cálculo e Digitação:** Inconsistências de cálculo em subtotais, quantidades e valores monetários causam prejuízos e retrabalho.
- **Falta de Histórico e Auditoria:** Dificuldade em rastrear qual vendedor emitiu qual proposta, com que valores e se houve alterações posteriores no documento.
- **Desatualização de Contatos:** Riscos de orçamentos históricos mudarem seus dados caso o vendedor mude de telefone ou saia da empresa.

### 1.3 Proposta de Valor
- **Emissão Guiada e Rápida:** Criação de orçamentos completos em menos de 2 minutos.
- **Autoria Automática e Imutável:** Vendedor logado tem nome e telefone atrelados automaticamente e fixados em snapshot no momento da emissão.
- **Identidade Visual Corporativa:** Cabeçalho timbrado padronizado com logotipo da empresa, cores institucionais e dados de contato.
- **Precisão Financeira Total:** Cálculos em centavos no banco de dados e na interface para eliminar dízimas ou erros de ponto flutuante.
- **Numeração Sequencial Garantida:** Cada organização possui seu prefixo e sequência contínua oficial (ex: `ORC-0001`), sem duplicidades.

---

## 2. Público-Alvo e Personas

### 2.1 Personas

#### Persona 1: Carlos (Vendedor Comercial / Usuário Operacional)
- **Perfil:** Vendedor em campo ou de escritório, atende dezenas de clientes diariamente via WhatsApp e e-mail.
- **Necessidades:**
  - Formulário intuitivo e sem distrações.
  - Não ter que preencher seus próprios dados manualmente a cada proposta.
  - Adicionar, editar ou remover itens com cálculo instantâneo.
  - Pré-visualizar o documento timbrado e gerar a versão de impressão/PDF com um clique.
- **Dores:** Perder negócios pela demora em enviar o orçamento ou cometer erros de cálculo de cabeça.

#### Persona 2: Mariana (Gerente Comercial / Administradora da Empresa)
- **Perfil:** Proprietária ou gestora que coordena a equipe de vendas e cuida da imagem da marca.
- **Necessidades:**
  - Personalizar a identidade da empresa (logo, cores, dados cadastrais).
  - Gerenciar os vendedores (cadastrar, atualizar contato, ativar/desativar).
  - Visualizar o painel geral de orçamentos de todos os vendedores e métricas agregadas (totais emitidos, rascunhos, cancelados).
  - Ter segurança de que propostas emitidas não podem ser alteradas indevidamente.
- **Dores:** Propostas com layouts diferentes, vendedores usando dados pessoais desatualizados e falta de controle sobre os valores ofertados.

---

## 3. Requisitos Funcionais (RF)

### 3.1 Autenticação e Gestão de Acessos
- **RF-01:** O sistema deve exigir autenticação individual para acesso a qualquer tela operacional.
- **RF-02:** O sistema deve suportar papéis de acesso diferenciados: `admin` (Administrador) e `seller` (Vendedor).
- **RF-03:** Cada usuário autenticado deve pertencer obrigatoriamente a uma Organização (`organization_id`).
- **RF-04:** Apenas usuários com status ativo (`active = true`) podem realizar login e executar ações no sistema.

### 3.2 Autoria e Perfil do Vendedor
- **RF-05:** O perfil do vendedor deve registrar nome completo, e-mail e telefone de contato profissional.
- **RF-06:** O vendedor deve ter uma tela de perfil (`/perfil`) para manter seus dados cadastrais e telefone atualizados.
- **RF-07:** Ao abrir um novo orçamento, o sistema deve preencher e exibir automaticamente os dados do vendedor logado, sem permitir troca de autoria pelo usuário.

### 3.3 Ciclo de Vida do Orçamento
- **RF-08 (Rascunho):** O sistema deve permitir salvar orçamentos no estado de rascunho (`draft`), permitindo edição ilimitada de cliente, itens e condições.
- **RF-09 (Validação do Formulário):** Para salvar ou emitir, deve ser obrigatório o nome do cliente e pelo menos 1 item com descrição, quantidade válida (> 0) e valor unitário (>= 0).
- **RF-10 (Emissão Transacional):** Ao emitir o orçamento (`issued`):
  - Deve ser atribuído o próximo número sequencial oficial da organização (ex: `ORC-0001`).
  - Devem ser gravados snapshots imutáveis do nome e telefone do vendedor responsável naquele instante (`seller_name_snapshot`, `seller_phone_snapshot`).
  - A data de emissão (`issued_at`) e data de validade (`valid_until`) devem ser registradas.
- **RF-11 (Imutabilidade):** Uma vez emitido (`issued`), o orçamento não pode mais ter seus dados, itens ou valores alterados.
- **RF-12 (Cancelamento):** O sistema deve permitir cancelar um orçamento emitido, exigindo justificativa obrigatória (`cancel_reason`) e registrando data e autor do cancelamento.
- **RF-13 (Exclusão Proibida):** Orçamentos emitidos ou vinculados a histórico oficial não podem ser excluídos fisicamente do banco de dados.

### 3.4 Gestão de Itens e Cálculos Financeiros
- **RF-14:** O formulário de orçamento deve permitir adicionar múltiplas linhas de itens dinamicamente.
- **RF-15:** Cada item deve conter: posição ordenada, descrição do produto/serviço, quantidade (suporte a fracionado/decimal), unidade opcional (ex: un, m², horas) e valor unitário em centavos.
- **RF-16:** O sistema deve calcular automaticamente o total de cada linha (`quantity * unit_price_cents`), o subtotal e o total geral.
- **RF-17:** Todos os cálculos exibidos na interface devem ser revalidados e recalculados no servidor/banco de dados para garantir integridade.

### 3.5 Documento Timbrado e Impressão
- **RF-18:** O sistema deve disponibilizar uma rota dedicada para visualização e impressão do documento (`/orcamentos/[id]/imprimir`).
- **RF-19:** O documento deve renderizar o papel timbrado com cabeçalho institucional (logotipo, dados da empresa), identificação do orçamento (número, versão, data, validade), dados do cliente, tabela de itens formatada, condições comerciais e dados de contato do vendedor.
- **RF-20:** O layout para impressão deve incluir estilos dedicados de CSS `@media print` que ocultem barras de navegação e botões, ajustem quebras de página e forcem a fidelidade de cores de fundo para exportação em PDF via navegador (`window.print()`).

### 3.6 Painel de Controle e Histórico
- **RF-21:** O sistema deve fornecer uma listagem paginada de orçamentos com busca textual por cliente ou número de proposta.
- **RF-22:** O histórico deve permitir filtros por status (`draft`, `issued`, `cancelled`, `expired`) e ordenação cronológica.
- **RF-23:** Vendedores comuns visualizam prioritariamente seus próprios orçamentos; administradores podem visualizar os orçamentos de toda a organização.
- **RF-24:** O topo da listagem deve apresentar cartões de métricas consolidadas (Total Emitido, Em Rascunho, Cancelados e Total Geral da Organização).

### 3.7 Módulo Administrativo
- **RF-25 (Configurações da Empresa):** O administrador pode configurar: nome fantasia, razão social, logotipo, cores primária e secundária, telefone, e-mail institucional, endereço, prefixo de orçamentos e dias padrão de validade.
- **RF-26 (Gestão de Vendedores):** O administrador pode convidar novos vendedores, visualizar lista de colaboradores, editar dados e ativar/desativar acessos.

---

## 4. Requisitos Não-Funcionais (RNF)

- **RNF-01 (Performance):** Tempo de resposta para carregamento de páginas internas com LCP < 1.5s em conexões de banda padrão. Server Actions devem responder em menos de 250ms.
- **RNF-02 (Precisão Monetária):** Todos os valores monetários devem ser armazenados como números inteiros em centavos (`bigint`), eliminando imprecisões de arredondamento em float.
- **RNF-03 (Segurança e RLS):** Todas as tabelas do banco de dados devem operar com Row Level Security (RLS) habilitado. Nenhuma operação direta via cliente sem passar por validação de organização ou sessão.
- **RNF-04 (Concorrência e Idempotência):** Operações de salvamento de rascunho devem utilizar controle de concorrência otimista (`version`) e token de idempotência (`last_write_request_id`) para evitar sobrescritas acidentais e envios duplicados.
- **RNF-05 (Responsividade):** A interface de formulário e listagem deve ser 100% responsiva (mobile, tablet e desktop), adaptando tabelas para cartões em telas estreitas.
- **RNF-06 (Auditoria):** Ações críticas (emissão, cancelamento, alteração de configurações e perfis) devem gerar registros na tabela `audit_events`.
- **RNF-07 (Acessibilidade):** Elementos interativos devem seguir as diretrizes WCAG 2.1 nível AA, incluindo foco visível, contraste adequado e labels semânticos em campos de formulário.

---

## 5. Critérios de Sucesso e KPIs

| Métrica / KPI | Meta Estabelecida |
| :--- | :--- |
| **Tempo médio de criação de orçamento** | Menos de 2 minutos por proposta emitida. |
| **Erros de cálculo ou discrepância financeira** | Zero incidentes (validação forçada no banco). |
| **Duplicidade de numeração sequencial** | Zero incidentes (concorrência bloqueada com lock de organização). |
| **Taxa de completude de propostas** | > 85% dos orçamentos iniciados convertidos em `issued`. |
| **Disponibilidade da plataforma** | 99.5% de uptime operacional. |

