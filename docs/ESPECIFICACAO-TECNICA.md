# Especificação técnica — sistema de orçamentos

## 1. Arquitetura lógica sugerida

Aplicação web responsiva com frontend e backend autenticado, banco relacional e serviço de geração de PDF. O backend é a fonte de verdade para permissões, cálculos, numeração e emissão. O PDF deve ser produzido a partir de um modelo versionado e dos dados persistidos.

Componentes:

1. **Frontend:** login, formulário de orçamento, prévia, histórico e área administrativa.
2. **API/backend:** autenticação, autorização, regras de negócio, persistência e geração/recuperação do PDF.
3. **Banco relacional:** usuários, empresa/configurações, orçamentos, itens e auditoria.
4. **Armazenamento de arquivos:** logotipo e PDFs emitidos, com acesso privado e URLs temporárias quando necessário.

Escolha de framework, hospedagem e provedor de autenticação deve considerar infraestrutura já disponível no projeto/empresa. Evitar armazenar credenciais ou PDFs em repositório público.

## 2. Modelo de dados proposto

Todos os registros devem ter `created_at` e, quando aplicável, `updated_at`. IDs internos devem ser UUIDs ou identificadores equivalentes.

### `organizations`

`id`, `display_name`, `legal_name` (opcional), `logo_storage_key`, `brand_primary_color`, `brand_secondary_color`, `contact_phone`, `contact_email`, `address` (opcional), `currency` (BRL), `timezone` (America/Sao_Paulo), `quote_prefix`, `next_quote_number`, `default_validity_days` (opcional), `template_version`.

### `users`

`id`, `organization_id`, `auth_subject`, `full_name`, `email`, `phone`, `role` (`admin` | `seller`), `active`, `created_at`, `updated_at`.

### `quotes`

`id`, `organization_id`, `quote_number`, `version`, `status`, `seller_user_id`, `seller_name_snapshot`, `seller_phone_snapshot`, `customer_name`, `customer_phone` (opcional), `customer_email` (opcional), `customer_tax_id` (opcional), `notes`, `payment_terms` (opcional), `issued_at`, `valid_until` (opcional), `currency`, `subtotal_cents`, `discount_cents` (default 0; habilitar somente por política), `total_cents`, `template_version`, `pdf_storage_key`, `created_at`, `updated_at`.

Restrições: unicidade em `(organization_id, quote_number, version)`; valores monetários inteiros; número visível sem reutilização; `seller_user_id` e snapshots preservados mesmo se a conta for desativada.

### `quote_items`

`id`, `quote_id`, `position`, `description`, `quantity` (decimal com escala definida pelo negócio), `unit` (opcional), `unit_price_cents`, `line_total_cents`, `created_at`.

### `audit_events`

`id`, `organization_id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `metadata` (sem segredos), `created_at`, `request_id`.

## 3. Estados e transições

```text
Rascunho ── emitir ──> Emitido ── cancelar ──> Cancelado
                              └── validade vencida ──> Expirado (derivado ou atualizado por rotina)
```

Edição permitida apenas em rascunho. Correções após emissão criam versão seguinte (ou novo orçamento, conforme regra aprovada) e mantêm PDF e dados da versão original. Cancelamento não apaga o registro.

## 4. API de referência

Rotas ilustrativas; podem ser adaptadas ao framework escolhido. Requerem sessão autenticada e autorização no servidor.

| Método e rota | Uso |
|---|---|
| `GET /api/me` | Retorna perfil e permissões do usuário atual |
| `GET /api/quotes?query=&status=&from=&to=&cursor=` | Lista paginada dentro do escopo permitido |
| `POST /api/quotes` | Cria rascunho e seus itens |
| `GET /api/quotes/{id}` | Consulta orçamento autorizado |
| `PATCH /api/quotes/{id}` | Atualiza rascunho autorizado com controle de versão |
| `POST /api/quotes/{id}/issue` | Valida, reserva número, congela snapshots, gera PDF e emite |
| `POST /api/quotes/{id}/cancel` | Registra cancelamento e motivo opcional |
| `GET /api/quotes/{id}/pdf` | Baixa PDF autorizado ou retorna URL assinada de curta duração |
| `GET /api/admin/users` | Lista usuários para administradores |
| `POST /api/admin/users` | Convida/cria vendedor |
| `PATCH /api/admin/users/{id}` | Atualiza perfil, papel ou status |
| `GET/PATCH /api/admin/organization` | Lê/altera identidade visual e configurações |

### Regras dos endpoints

- Validar payload no servidor e normalizar texto, quantidade e valores.
- Calcular subtotais e total no backend; ignorar totais enviados pelo navegador.
- Fazer emissão e alocação de número em transação para evitar duplicidade em concorrência.
- Usar chave de idempotência na emissão para que repetição por timeout não crie documentos duplicados.
- Retornar erros estruturados (`code`, `message`, `field_errors`, `request_id`) sem expor detalhes internos.
- Aplicar paginação e limites de tamanho em listagens e payloads.

## 5. Geração do PDF

- Gerar a partir dos dados persistidos após validação, não do HTML fornecido pelo cliente.
- Guardar PDF final em armazenamento privado e relacioná-lo à versão do orçamento.
- Definir nome de arquivo seguro, por exemplo `orcamento-{numero}-v{versao}.pdf`.
- Usar fonte legível, contraste adequado, moeda `R$ 1.234,56`, datas `DD/MM/AAAA` e quebra de tabela repetindo cabeçalho.
- Incluir logotipo e informações institucionais somente após aprovação da empresa.
- Não incluir dados opcionais vazios nem espaços reservados visíveis no documento final.
- Registrar versão do modelo usada para permitir reproduzir layout e explicar diferenças futuras.

## 6. Concorrência, integridade e recuperação

- Alocação do número de orçamento deve usar sequência/transação do banco por organização.
- Atualização de rascunho deve usar `updated_at` ou campo de versão otimista para identificar edição concorrente.
- Em falha de geração do PDF, manter estado consistente e permitir nova tentativa idempotente; não marcar como emitido se o artefato obrigatório não tiver sido persistido.
- Definir backups, retenção e teste periódico de restauração com o provedor escolhido.
