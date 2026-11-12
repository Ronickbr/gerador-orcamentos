-- ==============================================================================
-- MIGRATION: Índices de performance para otimização da rota /orcamentos
-- Data: 2026-11-11
--
-- 1. idx_quotes_org_created: listagem geral paginada ordenada por data.
-- 2. idx_quotes_org_seller_created: listagem do vendedor paginada por data.
-- 3. idx_quotes_org_status_created: filtro por status e data dentro da organização.
-- 4. idx_quotes_metrics_seller: agregação rápida de métricas para vendedor.
-- 5. idx_quotes_metrics_org: agregação rápida de métricas para admin da organização.
-- ==============================================================================

begin;

-- Índice para ordenação e paginação rápida da lista principal
create index if not exists idx_quotes_org_created
  on public.quotes (organization_id, created_at desc);

-- Índice para filtro por vendedor + paginação rápida por data
create index if not exists idx_quotes_org_seller_created
  on public.quotes (organization_id, seller_user_id, created_at desc);

-- Índice para filtro por status + paginação
create index if not exists idx_quotes_org_status_created
  on public.quotes (organization_id, status, created_at desc);

-- Índice composto para cálculo rápido de métricas e volume financeiro (vendedor)
create index if not exists idx_quotes_metrics_seller
  on public.quotes (organization_id, seller_user_id, status, total_cents)
  include (valid_until);

-- Índice composto para cálculo rápido de métricas e volume financeiro (organização)
create index if not exists idx_quotes_metrics_org
  on public.quotes (organization_id, status, total_cents)
  include (valid_until);

-- Índice para busca textual por cliente (se pg_trgm estiver disponível)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    create index if not exists idx_quotes_customer_name_trgm
      on public.quotes using gin (customer_name gin_trgm_ops);
    create index if not exists idx_quotes_number_trgm
      on public.quotes using gin (quote_number gin_trgm_ops);
  end if;
end $$;

commit;

