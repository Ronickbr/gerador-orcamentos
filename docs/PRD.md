# PRD — Sistema online de geração de orçamentos

**Status:** proposta para validação  
**Versão:** 1.0  
**Data:** 10/11/2026

## 1. Resumo

Criar uma aplicação web simples para que vendedores autenticados preparem um orçamento informando o cliente e os produtos/serviços com valores. O orçamento deve identificar automaticamente o vendedor responsável e seu telefone, aplicar o papel timbrado da empresa e permitir gerar um PDF pronto para compartilhar.

## 2. Problema e oportunidade

Hoje, a criação manual de propostas pode exigir copiar dados, formatar documentos e localizar contatos. Isso consome tempo e gera documentos inconsistentes ou sem identificação clara. Um fluxo padronizado reduz esforço e erros, preservando a identidade da empresa e a autoria do vendedor.

## 3. Objetivos

- Permitir que um vendedor gere um orçamento sem depender de edição manual de documentos.
- Preencher automaticamente nome e telefone do vendedor autenticado.
- Produzir documento com aparência profissional, identidade visual consistente e valores legíveis.
- Permitir visualizar, baixar e compartilhar o PDF.
- Manter histórico consultável dos orçamentos emitidos.

### Fora do escopo inicial

- Emissão de nota fiscal, cobrança ou pagamento.
- Assinatura eletrônica ou aceite contratual.
- CRM, estoque, ERP ou sincronização de preços.
- Envio automático por WhatsApp/e-mail, até que canal e credenciais sejam definidos.
- Aplicativo nativo para celular.

## 4. Usuários e permissões

| Perfil | Necessidades | Permissões principais |
|---|---|---|
| Vendedor | Criar e acompanhar seus orçamentos | Criar, visualizar e baixar os próprios; editar rascunhos |
| Administrador | Configurar equipe e identidade visual; acompanhar operação | Gerenciar vendedores, configurações e consultar orçamentos |

Uma política comercial poderá permitir que vendedores consultem orçamentos de toda a equipe; a decisão deve ser confirmada antes da implementação. A proposta padrão é restringir vendedores aos próprios registros.

## 5. Jornada principal

1. Vendedor entra com credenciais individuais.
2. Abre **Novo orçamento**.
3. Preenche nome do cliente e, opcionalmente, dados de contato e observações.
4. Adiciona uma ou mais linhas de produto/serviço, descrição, quantidade e preço unitário.
5. Confere subtotais, total, validade e condições comerciais disponíveis.
6. Visualiza a prévia com o papel timbrado e os dados do vendedor já preenchidos.
7. Salva o orçamento e gera/baixa o PDF.
8. Compartilha o arquivo pelo canal usual. O registro fica no histórico.

## 6. Requisitos funcionais

### Autenticação e equipe

- RF-01: exigir autenticação para acessar a aplicação.
- RF-02: associar cada conta a um vendedor ativo com nome e telefone de contato.
- RF-03: preencher o orçamento com os dados do vendedor autenticado, sem depender de digitação pelo usuário.
- RF-04: permitir que administrador cadastre, atualize, desative e redefina acesso de vendedores.
- RF-05: alterações futuras no perfil não devem alterar os dados históricos impressos em orçamentos já emitidos.

### Criação do orçamento

- RF-06: permitir cadastrar nome do cliente (obrigatório); telefone/e-mail e documento fiscal do cliente são opcionais e configuráveis.
- RF-07: permitir adicionar, remover e reordenar itens.
- RF-08: cada item deve aceitar descrição, quantidade e valor unitário; unidade pode ser opcional.
- RF-09: calcular subtotal por item e total automaticamente, com moeda BRL.
- RF-10: validar que quantidade e valores são numéricos e não negativos; impedir orçamento sem item válido.
- RF-11: oferecer observações, validade e condições de pagamento, de acordo com a configuração administrativa.
- RF-12: salvar como rascunho e permitir continuar editando antes de emitir.
- RF-13: gerar número único de orçamento e registrar data/hora de criação e emissão.
- RF-14: permitir pré-visualizar, baixar PDF e reabrir orçamento emitido.
- RF-15: após emissão, preservar uma cópia imutável dos dados usados no documento; correções devem gerar nova versão ou novo orçamento, mantendo o histórico.
- RF-16: oferecer busca e filtros no histórico por número, cliente, período e status dentro do escopo de permissão.

### Papel timbrado e documento

- RF-17: usar modelo central configurável pela administração: logotipo, nome empresarial e contatos institucionais aprovados.
- RF-18: exibir de forma destacada cliente, número/data, itens, quantidades, preços, total, validade/condições quando aplicável e identificação/telefone do vendedor.
- RF-19: gerar PDF paginado, com cabeçalho e rodapé consistentes, sem cortar linhas ou valores.
- RF-20: manter consistência entre prévia e PDF em desktop e celular.

## 7. Requisitos não funcionais

- RNF-01: interface responsiva, utilizável em celular, tablet e desktop.
- RNF-02: valores monetários devem ser armazenados em centavos inteiros, evitando erros de ponto flutuante.
- RNF-03: datas e horários registrados em UTC e apresentados no fuso configurado da empresa (padrão inicial: America/Sao_Paulo).
- RNF-04: proteger dados com controle de acesso no servidor; não confiar apenas em ocultação de telas.
- RNF-05: registrar eventos relevantes: criação, emissão, alteração de rascunho, cancelamento e ações administrativas.
- RNF-06: gerar documento legível em impressão A4 e PDF, incluindo quebra de página segura.
- RNF-07: comunicar erros de validação junto ao campo e preservar dados preenchidos em falhas recuperáveis.
- RNF-08: seguir princípios de minimização, finalidade e retenção de dados pessoais, com revisão de privacidade/LGPD antes do lançamento.

## 8. Regras de negócio

- RN-01: telefone e nome do vendedor vêm da conta autenticada e são copiados como snapshot no momento da emissão.
- RN-02: total = soma de (quantidade × preço unitário) de cada item, mais ajustes/descontos/impostos somente se a empresa habilitar explicitamente essas regras.
- RN-03: nenhuma regra de imposto, desconto, frete ou validade é presumida; deve ser definida pelo negócio.
- RN-04: cada orçamento recebe identificador único não previsível externamente; a numeração apresentada pode ser sequencial por empresa, sem expor IDs internos.
- RN-05: status inicial: Rascunho, Emitido, Cancelado e Expirado (expiração derivada de validade, se configurada).
- RN-06: orçamento emitido não pode ser sobrescrito silenciosamente. Alterações geram versão registrada ou novo documento.
- RN-07: o PDF deve mostrar que é um orçamento e informar que valores/condições estão sujeitos à validade indicada, se a empresa aprovar essa cláusula.

## 9. Dados mínimos

- Empresa: nome exibido, dados institucionais aprovados, logotipo, cores, configurações de moeda/fuso e numeração.
- Usuário/vendedor: nome, telefone, e-mail de login, papel, status.
- Cliente: nome; contato e dados adicionais opcionais.
- Orçamento: identificador, número visível, status, vendedor responsável e snapshot de seus dados, cliente, datas, validade, observações, totais e versão do modelo.
- Item: descrição, quantidade, unidade opcional, preço unitário em centavos e total em centavos.
- Evento: ator, ação, data/hora e referência ao orçamento.

## 10. Métricas de sucesso

- Tempo mediano entre abrir formulário e gerar orçamento (meta a definir após linha de base).
- Percentual de orçamentos concluídos sem correção manual de layout.
- Percentual de orçamentos que incluem corretamente vendedor e telefone.
- Taxa de erros/abandono na criação.
- Uso semanal por vendedores ativos.

## 11. Critérios de aceite da primeira versão

1. Usuário não autenticado não acessa dados nem cria orçamento.
2. Vendedor autenticado consegue preencher cliente e ao menos um item, salvar e emitir.
3. Quantidades, subtotais e total conferem em casos com múltiplos itens e valores decimais.
4. Nome e telefone impressos correspondem ao vendedor que emitiu, mesmo se seu perfil for alterado depois.
5. PDF contém papel timbrado, identificação do orçamento e todas as linhas, inclusive em documento com quebra de página.
6. Vendedor não acessa registros fora do seu escopo definido.
7. Administrador consegue atualizar identidade visual e dados de contato institucionais sem alterar documentos emitidos anteriormente.
8. Histórico permite localizar um orçamento emitido e baixar novamente sua versão arquivada.

## 12. Riscos e decisões abertas

- Identidade e dados que compõem o papel timbrado ainda não foram fornecidos.
- Regras de desconto, impostos, frete, validade, pagamento e aprovação precisam de decisão do negócio.
- Definir se o histórico do vendedor é individual ou compartilhado.
- Definir política de retenção, recuperação de senha e responsável por administrar usuários.
- Confirmar canal de envio e se a aplicação deve registrar comprovante/link de compartilhamento.
