# UX e conteúdo — fluxo de orçamentos

## 1. Navegação

- **Meus orçamentos**: busca, filtros, status, data, cliente e ações disponíveis.
- **Novo orçamento**: formulário guiado e prévia.
- **Administração** (administrador): vendedores, identidade da empresa e regras comerciais.

## 2. Formulário de criação

### Cabeçalho

Título: **Novo orçamento**. Exibir vendedor logado como informação já preenchida (nome e telefone), sem permitir troca de autoria. Se o telefone estiver ausente, mostrar instrução para atualizar o perfil ou contatar o administrador.

### Cliente

- Nome do cliente* — obrigatório.
- Telefone, e-mail e documento — opcionais, somente se houver finalidade aprovada.

### Itens

Cada linha contém:

- Produto/serviço* (descrição livre na primeira versão).
- Quantidade* (padrão 1, editável; unidade opcional).
- Valor unitário* (BRL).
- Total da linha (calculado, somente leitura).
- Ação para remover linha.

Botão **Adicionar item**. Exibir subtotal e total atualizados em tempo real, com indicação clara de moeda. Erros de número ou campo obrigatório aparecem no próprio campo.

### Condições e ações

- Validade e condições de pagamento aparecem conforme as regras definidas pela empresa.
- Observações são opcionais e limitadas em tamanho.
- Ações: **Salvar rascunho**, **Pré-visualizar**, **Emitir orçamento**. A emissão pede confirmação contextual e explica que cria uma versão oficial.

## 3. Prévia e documento

### Composição sugerida

1. Cabeçalho com logotipo e nome/dados empresariais aprovados.
2. Título “ORÇAMENTO”, número e data.
3. Identificação do cliente.
4. Tabela de itens: descrição, quantidade, valor unitário e total.
5. Total destacado.
6. Validade, condições e observações, se configuradas/preenchidas.
7. Contato do vendedor: nome e telefone.
8. Rodapé com contato institucional e paginação, sem poluir a leitura.

Na prévia, distinguir rascunho de documento emitido. O PDF deve manter os mesmos valores e hierarquia visual.

## 4. Histórico

- Mostrar número, cliente, data, total, status e vendedor conforme escopo.
- Busca por número ou nome do cliente; filtros por data e status.
- Ações por estado: abrir, baixar PDF, editar rascunho, cancelar (conforme permissão).
- Confirmar antes de cancelar; exigir motivo se essa política for aprovada.
- Estado vazio deve explicar como criar o primeiro orçamento.

## 5. Estados de interface

- Carregando: indicador e bloqueio de ações duplicadas.
- Erro temporário ao salvar: manter os dados no formulário e oferecer nova tentativa.
- Sem permissão: explicar que o perfil não tem acesso e indicar contato administrativo.
- Sem vendedor/telefone configurado: impedir emissão e apontar como corrigir.
- Falha na geração do PDF: informar que o orçamento não foi concluído ou que a emissão foi concluída sem arquivo, conforme o estado persistido; oferecer repetição segura.
- Sem resultados: informar filtros ativos e permitir limpá-los.

## 6. Acessibilidade e responsividade

- Campos com rótulos persistentes, foco visível e navegação por teclado.
- Não comunicar erros apenas por cor; associar mensagem ao campo.
- Contraste suficiente e textos legíveis em tela pequena.
- Em celular, organizar campos por item em cartões; tabela do PDF permanece adequada a A4.
- Confirmar remoção de item quando já houver dados inseridos.

## 7. Tom e textos

Usar português do Brasil, frases curtas e nomes consistentes: “Orçamento”, “Cliente”, “Produto/serviço”, “Valor unitário”, “Total”, “Salvar rascunho”, “Emitir orçamento” e “Baixar PDF”. Não prometer aprovação, disponibilidade de estoque, impostos ou condições que não estejam configurados.
