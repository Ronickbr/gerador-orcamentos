# Operação, segurança e lançamento

## 1. Acesso e proteção

- Contas individuais; não compartilhar login de vendedor.
- Exigir autenticação em todas as rotas privadas e validar autorização em cada leitura/alteração.
- Restringir vendedores aos seus orçamentos, salvo política empresarial explícita em contrário.
- Aplicar menor privilégio: apenas administradores alteram vendedores, papel timbrado e regras globais.
- Proteger sessões, cookies e endpoints; limitar tentativas de login e usar fluxo seguro de recuperação de acesso.
- Armazenar arquivos em bucket privado; links para PDF devem expirar e ser emitidos somente após autorização.
- Nunca colocar chaves de serviço, senhas ou tokens no frontend, repositório ou logs.
- Sanitizar conteúdo textual antes de renderizar HTML/PDF para impedir injeção de marcação ou scripts.

## 2. Privacidade e LGPD

O sistema pode tratar nome, telefone, e-mail e eventualmente documento de clientes e vendedores. Antes da produção, a empresa deve definir finalidade e base legal com seu responsável de privacidade/jurídico, aviso de privacidade, retenção, atendimento a solicitações dos titulares e processo de exclusão/anonimização quando aplicável. Coletar somente os dados necessários. Não usar os dados para outra finalidade sem avaliação adequada.

## 3. Auditoria e observabilidade

- Registrar emissão, cancelamento, mudança de perfil/configuração e tentativas relevantes de acesso negado.
- Logs devem incluir horário, ator, ação, entidade e identificador de requisição; não gravar senhas, tokens, conteúdo excessivo do cliente ou links assinados.
- Monitorar erros de autenticação, falhas de PDF, latência e indisponibilidade do banco/armazenamento.
- Definir responsável e canal interno para comunicar incidentes.

## 4. Ambiente e entrega

Manter ambientes separados de desenvolvimento, homologação e produção. Usar dados fictícios em desenvolvimento. Configurações e segredos por variáveis/secret manager da plataforma. Mudanças de banco devem ser versionadas por migrations revisáveis. Configurar domínio e HTTPS antes do acesso de vendedores.

## 5. Checklist operacional pré-lançamento

- [ ] Nome da empresa, logo, cores e contatos aprovados e carregados.
- [ ] Vendedores e administrador inicial cadastrados com telefone correto.
- [ ] Regras de validade, pagamento, desconto, frete e impostos decididas ou explicitamente desabilitadas.
- [ ] Escopo de visibilidade do histórico confirmado.
- [ ] Política de retenção e privacidade aprovada.
- [ ] Acesso de vendedor, administrador e usuário desativado revisados.
- [ ] PDFs com itens longos, múltiplas páginas, valores decimais e dados opcionais verificados.
- [ ] Backup, restauração e monitoração configurados.
- [ ] Procedimento de correção/cancelamento de orçamento emitido definido.
- [ ] Responsável pelo suporte e recuperação de acesso definido.

## 6. Plano de entrega recomendado

1. **Descoberta e decisões:** obter dados do papel timbrado e regras comerciais pendentes.
2. **Base:** autenticação, perfis, organização e permissões.
3. **Fluxo principal:** criação/edição de rascunho, cálculo, histórico e emissão.
4. **Documento:** modelo timbrado, geração, armazenamento e download do PDF.
5. **Administração:** gestão de vendedores e configurações.
6. **Homologação:** validar critérios de aceite com vendedores e ajustar linguagem/layout.
7. **Lançamento gradual:** começar com grupo pequeno, acompanhar problemas e ampliar.

## 7. Suporte e contingência

Se a geração do PDF falhar, preservar o rascunho e permitir nova tentativa sem duplicar número ou emissão. Se o serviço ficar indisponível, comunicar o canal de suporte definido pela empresa e evitar criar documentos paralelos sem controle. Em caso de suspeita de acesso indevido, revogar sessão/conta, preservar registros necessários e seguir o plano de resposta a incidentes da organização.
