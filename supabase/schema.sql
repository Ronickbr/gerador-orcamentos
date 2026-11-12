-- ==============================================================================
-- INSTALAÇÃO BASE — SISTEMA DE ORÇAMENTOS
-- Uso: banco NOVO. Rode este arquivo e, em seguida, a migration versionada:
--   supabase/migrations/20261111153000_security_and_integrity_hardening.sql
--
-- RLS, RPCs, policies, triggers de integridade e privilégios ficam na migration
-- (fonte única de verdade). Este arquivo só cria o modelo de dados.
-- ==============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. Organizações (identidade visual e numeração)
create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    display_name text not null,
    legal_name text,
    logo_storage_key text,
    brand_primary_color text not null default '#1e40af',
    brand_secondary_color text not null default '#3b82f6',
    contact_phone text,
    contact_email text,
    address text,
    currency text not null default 'BRL',
    timezone text not null default 'America/Sao_Paulo',
    quote_prefix text not null default 'ORC',
    next_quote_number integer not null default 1,
    default_validity_days integer,
    template_version integer not null default 1,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. Perfis (vinculados a auth.users; provisionados por admin, nunca promovidos
--    automaticamente a partir de metadados do cadastro)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    organization_id uuid not null references public.organizations (id) on delete restrict,
    full_name text not null,
    email text not null,
    phone text,
    role text not null default 'seller' check (role in ('admin', 'seller')),
    active boolean not null default true,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 3. Orçamentos
create table if not exists public.quotes (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete restrict,
    quote_number text,
    quote_sequence integer,
    version integer not null default 1,
    status text not null default 'draft'
        check (status in ('draft', 'issued', 'cancelled', 'expired')),
    seller_user_id uuid not null references public.profiles (id) on delete restrict,
    seller_name_snapshot text,
    seller_phone_snapshot text,
    customer_name text not null,
    customer_phone text,
    customer_email text,
    customer_tax_id text,
    notes text,
    payment_terms text,
    issued_at timestamptz,
    valid_until timestamptz,
    currency text not null default 'BRL',
    subtotal_cents bigint not null default 0,
    discount_cents bigint not null default 0,
    total_cents bigint not null default 0,
    template_version integer not null default 1,
    pdf_storage_key text,
    cancel_reason text,
    cancelled_at timestamptz,
    cancelled_by uuid references public.profiles (id) on delete set null,
    last_write_request_id uuid,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint unique_org_quote_seq_version unique (organization_id, quote_sequence, version)
);

-- 4. Itens do orçamento (line_total é derivado no banco)
create table if not exists public.quote_items (
    id uuid primary key default gen_random_uuid(),
    quote_id uuid not null references public.quotes (id) on delete cascade,
    position integer not null,
    description text not null,
    quantity numeric(12, 3) not null default 1.0,
    unit text,
    unit_price_cents bigint not null default 0,
    line_total_cents bigint not null default 0,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 5. Auditoria
create table if not exists public.audit_events (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    actor_user_id uuid references public.profiles (id) on delete set null,
    entity_type text not null,
    entity_id text not null,
    action text not null,
    metadata jsonb,
    request_id text,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 6. Índices
create index if not exists idx_profiles_org on public.profiles (organization_id);
create index if not exists idx_quotes_org on public.quotes (organization_id);
create index if not exists idx_quotes_seller on public.quotes (seller_user_id);
create index if not exists idx_quotes_status on public.quotes (status);
create index if not exists idx_quote_items_quote on public.quote_items (quote_id);
create index if not exists idx_audit_events_org on public.audit_events (organization_id);

-- 7. updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists update_organizations_updated_at on public.organizations;
create trigger update_organizations_updated_at
before update on public.organizations
for each row execute function public.handle_updated_at();

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

drop trigger if exists update_quotes_updated_at on public.quotes;
create trigger update_quotes_updated_at
before update on public.quotes
for each row execute function public.handle_updated_at();
