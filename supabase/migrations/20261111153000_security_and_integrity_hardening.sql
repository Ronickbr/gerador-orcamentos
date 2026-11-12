-- ==============================================================================
-- MIGRATION: endurecimento de segurança, integridade e emissão transacional
-- Data: 2026-11-11
-- Aplicar em base EXISTENTE, após revisão e backup. NÃO apaga dados.
--
-- 1. Isolamento por organização sem recursão de RLS (helpers SECURITY DEFINER).
-- 2. Bloqueia autopromoção a admin e provisionamento automático.
-- 3. Emissão/cancelamento idempotentes usando auth.uid() (não p_user_id).
-- 4. RPC transacional save_quote_draft com versão otimista e request_id.
-- 5. Totais e line_total recalculados no banco (não confia no cliente).
-- 6. Numeração cresce sem truncar em 10.000 (sem LPAD fixo de 4).
-- 7. active exigido em todos os acessos; anon sem privilégios.
-- 8. Auditoria escrita na mesma transação da operação.
-- 9. View quote_list para busca/paginação no servidor e status derivado.
-- 10. RPC quote_metrics para métricas reais (não parciais por página).
--
-- Fora do escopo: aplicar a migration, deploy e testes contra banco real.
-- Este arquivo NÃO foi executado.
-- ==============================================================================

begin;

create extension if not exists pgcrypto;

-- ==============================================================================
-- 1. COLUNAS DE DOMÍNIO
-- ==============================================================================

alter table public.quotes
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists last_write_request_id uuid;

comment on column public.quotes.cancel_reason is 'Motivo informado no cancelamento.';
comment on column public.quotes.last_write_request_id is 'Idempotência de save_quote_draft (repetição segura).';

create index if not exists idx_quotes_org_status_created
  on public.quotes (organization_id, status, created_at desc);
create index if not exists idx_quotes_org_customer
  on public.quotes (organization_id, customer_name);
create index if not exists idx_audit_events_created
  on public.audit_events (organization_id, created_at desc);

-- ==============================================================================
-- 2. CONSTRAINTS (NOT VALID: não quebram histórico já gravado)
-- ==============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quotes_totals_nonnegative') then
    alter table public.quotes
      add constraint quotes_totals_nonnegative
      check (subtotal_cents >= 0 and discount_cents >= 0 and total_cents >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'quotes_draft_has_no_issued_fields') then
    alter table public.quotes
      add constraint quotes_draft_has_no_issued_fields
      check (
        status <> 'draft'
        or (quote_number is null and quote_sequence is null and issued_at is null)
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'quotes_cancelled_has_reason_state') then
    alter table public.quotes
      add constraint quotes_cancelled_has_reason_state
      check (status <> 'cancelled' or cancelled_at is not null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'quote_items_quantity_positive') then
    alter table public.quote_items
      add constraint quote_items_quantity_positive check (quantity > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'quote_items_amounts_nonnegative') then
    alter table public.quote_items
      add constraint quote_items_amounts_nonnegative
      check (unit_price_cents >= 0 and line_total_cents >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'quote_items_position_positive') then
    alter table public.quote_items
      add constraint quote_items_position_positive check (position > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_role_valid') then
    alter table public.profiles
      add constraint profiles_role_valid check (role in ('admin', 'seller')) not valid;
  end if;
end $$;

-- Unicidade do número do orçamento. Só cria o índice se não houver duplicidade
-- prévia; caso contrário avisa para limpeza manual (não apaga dados).
do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes
  from (
    select organization_id, quote_number, version
    from public.quotes
    where quote_number is not null
    group by 1, 2, 3
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    create unique index if not exists uniq_org_quote_number_version
      on public.quotes (organization_id, quote_number, version)
      where quote_number is not null;
  else
    raise notice 'uniq_org_quote_number_version não criado: % duplicidade(s) a resolver manualmente.', v_dupes;
  end if;
end $$;

-- ==============================================================================
-- 3. HELPERS SEM RECURSÃO DE RLS
-- ==============================================================================

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid() and p.active
  limit 1
$$;

create or replace function public.is_active_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active
      and p.organization_id = p_organization_id
  )
$$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active
      and p.role = 'admin'
      and p.organization_id = p_organization_id
  )
$$;

-- Provisionamento: mantém a assinatura usada pela aplicação, mas NÃO promove
-- ninguém a admin nem cria organização. Perfil inexistente = acesso negado.
create or replace function public.ensure_current_user_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_org public.organizations;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Não autenticado');
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Perfil não provisionado. Solicite acesso ao administrador.'
    );
  end if;

  if not v_profile.active then
    return jsonb_build_object('success', false, 'error', 'Usuário inativo.');
  end if;

  select * into v_org from public.organizations where id = v_profile.organization_id;
  return jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_profile),
    'organization', row_to_json(v_org)
  );
end;
$$;

-- ==============================================================================
-- 4. RLS: remove políticas antigas (nomes divergem entre scripts) e recria
-- ==============================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.audit_events enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('organizations', 'profiles', 'quotes', 'quote_items', 'audit_events')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ORGANIZATIONS: leitura para membro ativo; escrita apenas admin ativo.
create policy "organizations_select_active_member"
on public.organizations for select to authenticated
using (public.is_active_member(id));

create policy "organizations_update_admin"
on public.organizations for update to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

-- PROFILES: leitura do próprio perfil e da organização; escrita limitada.
create policy "profiles_select_self"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "profiles_select_org_members"
on public.profiles for select to authenticated
using (public.is_active_member(organization_id));

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid() and active)
with check (id = auth.uid() and active);

create policy "profiles_update_admin"
on public.profiles for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- QUOTES: isolamento por organização + active + dono/admin.
create policy "quotes_select_scoped"
on public.quotes for select to authenticated
using (
  public.is_active_member(organization_id)
  and (seller_user_id = auth.uid() or public.is_org_admin(organization_id))
);

create policy "quotes_insert_own_draft"
on public.quotes for insert to authenticated
with check (
  seller_user_id = auth.uid()
  and public.is_active_member(organization_id)
  and status = 'draft'
  and quote_number is null
  and quote_sequence is null
  and issued_at is null
);

create policy "quotes_update_own_draft"
on public.quotes for update to authenticated
using (
  public.is_active_member(organization_id)
  and status = 'draft'
  and (seller_user_id = auth.uid() or public.is_org_admin(organization_id))
)
with check (
  public.is_active_member(organization_id)
  and status = 'draft'
  and (seller_user_id = auth.uid() or public.is_org_admin(organization_id))
);

create policy "quotes_delete_own_draft"
on public.quotes for delete to authenticated
using (
  public.is_active_member(organization_id)
  and status = 'draft'
  and (seller_user_id = auth.uid() or public.is_org_admin(organization_id))
);

-- QUOTE_ITEMS: leitura/escrita sempre amarrada a orçamento autorizado.
create policy "quote_items_select_scoped"
on public.quote_items for select to authenticated
using (
  exists (
    select 1 from public.quotes q
    where q.id = quote_items.quote_id
      and public.is_active_member(q.organization_id)
      and (q.seller_user_id = auth.uid() or public.is_org_admin(q.organization_id))
  )
);

create policy "quote_items_write_own_draft"
on public.quote_items for all to authenticated
using (
  exists (
    select 1 from public.quotes q
    where q.id = quote_items.quote_id
      and public.is_active_member(q.organization_id)
      and q.status = 'draft'
      and (q.seller_user_id = auth.uid() or public.is_org_admin(q.organization_id))
  )
)
with check (
  exists (
    select 1 from public.quotes q
    where q.id = quote_items.quote_id
      and public.is_active_member(q.organization_id)
      and q.status = 'draft'
      and (q.seller_user_id = auth.uid() or public.is_org_admin(q.organization_id))
  )
);

-- AUDIT_EVENTS: admin lê a própria organização; membro ativo registra só a si.
create policy "audit_events_select_admin"
on public.audit_events for select to authenticated
using (public.is_org_admin(organization_id));

create policy "audit_events_insert_own"
on public.audit_events for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_active_member(organization_id)
);

-- ==============================================================================
-- 5. PRIVILÉGIOS: anon sem acesso; escrita de quotes/itens/auditoria via RPC
-- ==============================================================================

revoke all on schema public from anon;
grant usage on schema public to authenticated, service_role;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on public.organizations, public.profiles, public.quotes,
  public.quote_items, public.audit_events to authenticated;

-- profiles: usuário só edita nome/telefone; papel/org/active via RPC de admin.
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- organizations: nunca via next_quote_number ou id.
revoke insert, update, delete, truncate, references, trigger on public.organizations from authenticated;
grant update (
  display_name, legal_name, logo_storage_key, brand_primary_color,
  brand_secondary_color, contact_phone, contact_email, address, currency,
  timezone, quote_prefix, default_validity_days
) on public.organizations to authenticated;

-- quotes/quote_items/audit: sem escrita direta (usar RPCs abaixo).
revoke insert, update, delete, truncate, references, trigger
  on public.quotes, public.quote_items, public.audit_events from authenticated;

-- EXECUTE das funções é tratado no bloco final (após a criação de todas elas).

-- ==============================================================================
-- 6. INTEGRIDADE FINANCEIRA NO BANCO
-- ==============================================================================

-- line_total sempre derivado de quantidade x preço unitário.
create or replace function public.quote_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.description := btrim(coalesce(new.description, ''));
  if new.description = '' then
    raise exception 'Descrição do item é obrigatória';
  end if;
  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;
  if new.unit_price_cents is null or new.unit_price_cents < 0 then
    raise exception 'Valor unitário inválido';
  end if;

  new.line_total_cents := round(new.quantity * new.unit_price_cents)::bigint;
  new.unit := nullif(btrim(coalesce(new.unit, '')), '');
  return new;
end;
$$;

drop trigger if exists trg_quote_items_before_write on public.quote_items;
create trigger trg_quote_items_before_write
before insert or update on public.quote_items
for each row execute function public.quote_items_before_write();

-- Totais do rascunho sempre somados a partir dos itens.
create or replace function public.refresh_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id uuid;
  v_subtotal bigint;
begin
  if tg_op = 'DELETE' then
    v_quote_id := old.quote_id;
  else
    v_quote_id := new.quote_id;
  end if;

  select coalesce(sum(line_total_cents), 0)
    into v_subtotal
  from public.quote_items
  where quote_id = v_quote_id;

  update public.quotes
     set subtotal_cents = v_subtotal,
         total_cents = greatest(v_subtotal - discount_cents, 0)
   where id = v_quote_id
     and status = 'draft';

  return null;
end;
$$;

drop trigger if exists trg_quote_items_refresh_totals on public.quote_items;
create trigger trg_quote_items_refresh_totals
after insert or update or delete on public.quote_items
for each row execute function public.refresh_quote_totals();

-- Regras de quotes: rascunho não nasce numerado nem com total inventado.
create or replace function public.quotes_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subtotal bigint;
begin
  new.discount_cents := greatest(coalesce(new.discount_cents, 0), 0);

  if tg_op = 'INSERT' then
    if new.status = 'draft' then
      new.quote_number := null;
      new.quote_sequence := null;
      new.issued_at := null;
      new.subtotal_cents := 0;
      new.total_cents := 0;
    end if;
    return new;
  end if;

  if new.status = 'draft' then
    select coalesce(sum(line_total_cents), 0)
      into v_subtotal
    from public.quote_items
    where quote_id = new.id;

    new.subtotal_cents := v_subtotal;
    new.total_cents := greatest(v_subtotal - new.discount_cents, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quotes_before_write on public.quotes;
create trigger trg_quotes_before_write
before insert or update on public.quotes
for each row execute function public.quotes_before_write();

-- ==============================================================================
-- 7. EMISSÃO E CANCELAMENTO (ator vem de auth.uid())
-- ==============================================================================

drop function if exists public.issue_quote(uuid, uuid);
drop function if exists public.cancel_quote(uuid, uuid, text);

create or replace function public.issue_quote(
  p_quote_id uuid,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_quote public.quotes;
  v_org public.organizations;
  v_sequence integer;
  v_number text;
  v_subtotal bigint;
  v_total bigint;
  v_item_count integer;
  v_valid_until timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active then
    raise exception 'Usuário inativo ou sem perfil';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Orçamento não encontrado';
  end if;

  if v_quote.organization_id <> v_actor.organization_id then
    raise exception 'Organização inválida';
  end if;

  if v_actor.role <> 'admin' and v_quote.seller_user_id <> v_actor.id then
    raise exception 'Permissão negada para emitir este orçamento';
  end if;

  -- Idempotente: repetir a emissão devolve o mesmo número, sem novo sequencial.
  if v_quote.status = 'issued' and v_quote.quote_number is not null then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'quote_id', v_quote.id,
      'quote_number', v_quote.quote_number,
      'quote_sequence', v_quote.quote_sequence,
      'status', 'issued',
      'version', v_quote.version
    );
  end if;

  if v_quote.status <> 'draft' then
    raise exception 'Apenas rascunhos podem ser emitidos';
  end if;

  if p_expected_version is not null and p_expected_version <> v_quote.version then
    raise exception 'Conflito de versão: recarregue o orçamento antes de emitir';
  end if;

  select count(*) into v_item_count from public.quote_items where quote_id = v_quote.id;
  if v_item_count = 0 then
    raise exception 'O orçamento precisa de pelo menos um item';
  end if;

  if v_quote.customer_name is null or btrim(v_quote.customer_name) = '' then
    raise exception 'Nome do cliente é obrigatório';
  end if;

  select * into v_org from public.organizations where id = v_quote.organization_id for update;
  if not found then
    raise exception 'Organização não encontrada';
  end if;

  v_sequence := v_org.next_quote_number;
  v_number := rtrim(coalesce(v_org.quote_prefix, 'ORC'), '-')
    || '-' || lpad(v_sequence::text, greatest(4, length(v_sequence::text)), '0');

  update public.organizations
     set next_quote_number = v_sequence + 1
   where id = v_org.id;

  select coalesce(sum(line_total_cents), 0)
    into v_subtotal
  from public.quote_items
  where quote_id = v_quote.id;

  v_total := greatest(v_subtotal - v_quote.discount_cents, 0);

  -- Validade customizada é preservada; default só quando não houver data.
  if v_quote.valid_until is null
     and v_org.default_validity_days is not null
     and v_org.default_validity_days > 0 then
    v_valid_until := now() + make_interval(days => v_org.default_validity_days);
  else
    v_valid_until := v_quote.valid_until;
  end if;

  update public.quotes
     set status = 'issued',
         quote_number = v_number,
         quote_sequence = v_sequence,
         seller_name_snapshot = coalesce(nullif(btrim(v_actor.full_name), ''), seller_name_snapshot),
         seller_phone_snapshot = coalesce(v_actor.phone, seller_phone_snapshot),
         issued_at = now(),
         valid_until = v_valid_until,
         subtotal_cents = v_subtotal,
         total_cents = v_total,
         version = v_quote.version + 1
   where id = v_quote.id;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_quote.organization_id, v_actor.id, 'quote', v_quote.id::text, 'issue',
    jsonb_build_object('quote_number', v_number, 'total_cents', v_total)
  );

  return jsonb_build_object(
    'success', true,
    'quote_id', v_quote.id,
    'quote_number', v_number,
    'quote_sequence', v_sequence,
    'status', 'issued',
    'version', v_quote.version + 1
  );
end;
$$;

create or replace function public.cancel_quote(
  p_quote_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_quote public.quotes;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active then
    raise exception 'Usuário inativo ou sem perfil';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Orçamento não encontrado';
  end if;

  if v_quote.organization_id <> v_actor.organization_id then
    raise exception 'Organização inválida';
  end if;

  if v_actor.role <> 'admin' and v_quote.seller_user_id <> v_actor.id then
    raise exception 'Permissão negada para cancelar este orçamento';
  end if;

  if v_quote.status = 'cancelled' then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'status', 'cancelled',
      'version', v_quote.version
    );
  end if;

  if v_quote.status <> 'issued' then
    raise exception 'Apenas orçamentos emitidos podem ser cancelados';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  update public.quotes
     set status = 'cancelled',
         cancel_reason = v_reason,
         cancelled_at = now(),
         cancelled_by = v_actor.id,
         version = v_quote.version + 1
   where id = v_quote.id;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_quote.organization_id, v_actor.id, 'quote', v_quote.id::text, 'cancel',
    jsonb_build_object('reason', v_reason, 'quote_number', v_quote.quote_number)
  );

  return jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'version', v_quote.version + 1
  );
end;
$$;

-- ==============================================================================
-- 8. SALVAMENTO TRANSACIONAL DE RASCUNHO (versão otimista + idempotência)
-- ==============================================================================

create or replace function public.save_quote_draft(
  p_quote_id uuid,
  p_expected_version integer,
  p_quote jsonb,
  p_items jsonb,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_quote public.quotes;
  v_existing public.quotes;
  v_item jsonb;
  v_position integer := 0;
  v_customer text;
  v_valid_until timestamptz;
  v_validity_days integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active then
    raise exception 'Usuário inativo ou sem perfil';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe pelo menos um item';
  end if;

  v_customer := nullif(btrim(coalesce(p_quote->>'customer_name', '')), '');
  if v_customer is null then
    raise exception 'Nome do cliente é obrigatório';
  end if;

  if nullif(btrim(coalesce(p_quote->>'customer_email', '')), '') is not null
     and (p_quote->>'customer_email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
    raise exception 'E-mail do cliente inválido';
  end if;

  v_validity_days := nullif(p_quote->>'validity_days', '')::integer;
  if v_validity_days is not null and (v_validity_days < 1 or v_validity_days > 365) then
    raise exception 'Validade deve ficar entre 1 e 365 dias';
  end if;

  v_valid_until := case
    when v_validity_days is not null then now() + make_interval(days => v_validity_days)
    else nullif(p_quote->>'valid_until', '')::timestamptz
  end;

  if p_quote_id is null then
    p_quote_id := gen_random_uuid();
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;

  if not found then
    insert into public.quotes (
      id, organization_id, seller_user_id, version, status,
      customer_name, customer_phone, customer_email, customer_tax_id,
      notes, payment_terms, discount_cents, valid_until, last_write_request_id
    ) values (
      p_quote_id, v_actor.organization_id, v_actor.id, 0, 'draft',
      v_customer,
      nullif(btrim(coalesce(p_quote->>'customer_phone', '')), ''),
      nullif(btrim(coalesce(p_quote->>'customer_email', '')), ''),
      nullif(btrim(coalesce(p_quote->>'customer_tax_id', '')), ''),
      nullif(btrim(coalesce(p_quote->>'notes', '')), ''),
      nullif(btrim(coalesce(p_quote->>'payment_terms', '')), ''),
      greatest(coalesce((p_quote->>'discount_cents')::bigint, 0), 0),
      v_valid_until,
      p_request_id
    )
    returning * into v_quote;
  else
    if v_quote.organization_id <> v_actor.organization_id then
      raise exception 'Organização inválida';
    end if;

    if v_quote.status <> 'draft' then
      raise exception 'Somente rascunhos podem ser alterados';
    end if;

    if v_actor.role <> 'admin' and v_quote.seller_user_id <> v_actor.id then
      raise exception 'Permissão negada para alterar este orçamento';
    end if;

    -- Repetição segura do mesmo envio: devolve o estado atual sem duplicar.
    if p_request_id is not null
       and v_quote.last_write_request_id is not distinct from p_request_id then
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'quote_id', v_quote.id,
        'version', v_quote.version,
        'subtotal_cents', v_quote.subtotal_cents,
        'total_cents', v_quote.total_cents
      );
    end if;

    if p_expected_version is null or p_expected_version <> v_quote.version then
      raise exception 'Conflito de versão: o orçamento foi alterado em outra sessão';
    end if;

    update public.quotes
       set customer_name = v_customer,
           customer_phone = nullif(btrim(coalesce(p_quote->>'customer_phone', '')), ''),
           customer_email = nullif(btrim(coalesce(p_quote->>'customer_email', '')), ''),
           customer_tax_id = nullif(btrim(coalesce(p_quote->>'customer_tax_id', '')), ''),
           notes = nullif(btrim(coalesce(p_quote->>'notes', '')), ''),
           payment_terms = nullif(btrim(coalesce(p_quote->>'payment_terms', '')), ''),
           discount_cents = greatest(coalesce((p_quote->>'discount_cents')::bigint, 0), 0),
           valid_until = v_valid_until,
           version = v_quote.version + 1,
           last_write_request_id = p_request_id
     where id = v_quote.id
     returning * into v_quote;
  end if;

  delete from public.quote_items where quote_id = v_quote.id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    insert into public.quote_items (
      quote_id, position, description, quantity, unit, unit_price_cents
    ) values (
      v_quote.id,
      v_position,
      coalesce(v_item->>'description', ''),
      coalesce(nullif(v_item->>'quantity', '')::numeric, 1),
      v_item->>'unit',
      coalesce(nullif(v_item->>'unit_price_cents', '')::bigint, 0)
    );
  end loop;

  select * into v_quote from public.quotes where id = v_quote.id;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_quote.organization_id, v_actor.id, 'quote', v_quote.id::text, 'save_draft',
    jsonb_build_object('version', v_quote.version, 'items', jsonb_array_length(p_items))
  );

  return jsonb_build_object(
    'success', true,
    'quote_id', v_quote.id,
    'version', v_quote.version,
    'subtotal_cents', v_quote.subtotal_cents,
    'discount_cents', v_quote.discount_cents,
    'total_cents', v_quote.total_cents
  );
end;
$$;

-- ==============================================================================
-- 9. CONFIGURAÇÕES DA ORGANIZAÇÃO (admin) + AUDITORIA ATÔMICA
-- ==============================================================================

create or replace function public.update_organization_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_org public.organizations;
  v_prefix text;
  v_validity integer;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active or v_actor.role <> 'admin' then
    raise exception 'Apenas administradores ativos podem alterar a organização';
  end if;

  select * into v_org from public.organizations where id = v_actor.organization_id for update;
  if not found then
    raise exception 'Organização não encontrada';
  end if;

  v_prefix := nullif(btrim(coalesce(p_payload->>'quote_prefix', '')), '');
  if v_prefix is not null and char_length(v_prefix) > 12 then
    raise exception 'Prefixo deve ter no máximo 12 caracteres';
  end if;

  v_validity := nullif(p_payload->>'default_validity_days', '')::integer;
  if v_validity is not null and (v_validity < 1 or v_validity > 365) then
    raise exception 'Validade padrão deve ficar entre 1 e 365 dias';
  end if;

  if exists (
    select 1 from jsonb_each_text(jsonb_build_object(
      'brand_primary_color', p_payload->>'brand_primary_color',
      'brand_secondary_color', p_payload->>'brand_secondary_color'
    )) c
    where c.value is not null and c.value !~ '^#[0-9a-fA-F]{6}$'
  ) then
    raise exception 'Cores devem estar no formato hexadecimal #RRGGBB';
  end if;

  update public.organizations
     set display_name = coalesce(nullif(btrim(p_payload->>'display_name'), ''), display_name),
         legal_name = case when p_payload ? 'legal_name'
                           then nullif(btrim(p_payload->>'legal_name'), '')
                           else legal_name end,
         contact_phone = case when p_payload ? 'contact_phone'
                              then nullif(btrim(p_payload->>'contact_phone'), '')
                              else contact_phone end,
         contact_email = case when p_payload ? 'contact_email'
                              then nullif(btrim(p_payload->>'contact_email'), '')
                              else contact_email end,
         address = case when p_payload ? 'address'
                        then nullif(btrim(p_payload->>'address'), '')
                        else address end,
         brand_primary_color = coalesce(p_payload->>'brand_primary_color', brand_primary_color),
         brand_secondary_color = coalesce(p_payload->>'brand_secondary_color', brand_secondary_color),
         quote_prefix = coalesce(v_prefix, quote_prefix),
         default_validity_days = v_validity,
         template_version = template_version + 1
   where id = v_org.id
   returning * into v_org;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_org.id, v_actor.id, 'organization', v_org.id::text,
    'update_organization_settings', p_payload
  );

  return jsonb_build_object('success', true, 'organization', row_to_json(v_org));
end;
$$;

-- ==============================================================================
-- 10. GESTÃO DE EQUIPE (admin) — sem signUp no cliente, sem segredo exposto
-- ==============================================================================

create or replace function public.admin_provision_seller(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_profile public.profiles;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active or v_actor.role <> 'admin' then
    raise exception 'Apenas administradores ativos podem provisionar usuários';
  end if;

  if p_role not in ('admin', 'seller') then
    raise exception 'Papel inválido';
  end if;

  if nullif(btrim(coalesce(p_full_name, '')), '') is null
     or nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'Nome e e-mail são obrigatórios';
  end if;

  insert into public.profiles (
    id, organization_id, full_name, email, phone, role, active
  ) values (
    p_user_id,
    v_actor.organization_id,
    btrim(p_full_name),
    lower(btrim(p_email)),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_role,
    true
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        role = excluded.role
  returning * into v_profile;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'user', p_user_id::text, 'provision_user',
    jsonb_build_object('email', lower(btrim(p_email)), 'role', p_role)
  );

  return jsonb_build_object('success', true, 'profile', row_to_json(v_profile));
end;
$$;

create or replace function public.admin_update_profile(
  p_profile_id uuid,
  p_full_name text,
  p_phone text,
  p_role text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active or v_actor.role <> 'admin' then
    raise exception 'Apenas administradores ativos podem alterar usuários';
  end if;

  select * into v_target from public.profiles where id = p_profile_id for update;
  if not found or v_target.organization_id <> v_actor.organization_id then
    raise exception 'Usuário não encontrado nesta organização';
  end if;

  if p_profile_id = v_actor.id and (p_active = false or p_role <> 'admin') then
    raise exception 'Você não pode desativar ou rebaixar o próprio acesso';
  end if;

  if p_role not in ('admin', 'seller') then
    raise exception 'Papel inválido';
  end if;

  update public.profiles
     set full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
         phone = nullif(btrim(coalesce(p_phone, '')), ''),
         role = p_role,
         active = p_active
   where id = p_profile_id
   returning * into v_target;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'user', p_profile_id::text, 'update_user',
    jsonb_build_object('role', p_role, 'active', p_active)
  );

  return jsonb_build_object('success', true, 'profile', row_to_json(v_target));
end;
$$;

-- ==============================================================================
-- 11. VIEW DE LISTAGEM + MÉTRICAS (busca/paginação no servidor)
-- ==============================================================================

create or replace view public.quote_list
with (security_invoker = true) as
select
  q.id,
  q.organization_id,
  q.quote_number,
  q.quote_sequence,
  q.version,
  case
    when q.status = 'issued'
      and q.valid_until is not null
      and q.valid_until < now() then 'expired'
    else q.status
  end as status,
  q.status as stored_status,
  q.seller_user_id,
  coalesce(q.seller_name_snapshot, p.full_name) as seller_name,
  q.customer_name,
  q.customer_phone,
  q.customer_email,
  q.customer_tax_id,
  q.notes,
  q.payment_terms,
  q.issued_at,
  q.valid_until,
  q.currency,
  q.subtotal_cents,
  q.discount_cents,
  q.total_cents,
  q.cancel_reason,
  q.created_at,
  q.updated_at
from public.quotes q
left join public.profiles p on p.id = q.seller_user_id;

grant select on public.quote_list to authenticated;

create or replace function public.quote_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_result jsonb;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active then
    raise exception 'Usuário inativo ou sem perfil';
  end if;

  select jsonb_build_object(
    'total_count', count(*),
    'issued_count', count(*) filter (
      where status = 'issued' and (valid_until is null or valid_until >= now())
    ),
    'draft_count', count(*) filter (where status = 'draft'),
    'cancelled_count', count(*) filter (where status = 'cancelled'),
    'expired_count', count(*) filter (
      where status = 'issued' and valid_until is not null and valid_until < now()
    ),
    'active_volume_cents', coalesce(sum(total_cents) filter (where status in ('draft', 'issued')), 0)
  )
  into v_result
  from public.quotes
  where organization_id = v_actor.organization_id
    and (v_actor.role = 'admin' or seller_user_id = v_actor.id);

  return v_result;
end;
$$;

-- ==============================================================================
-- 12. GRANTS FINAIS
-- Executado DEPOIS de todas as funções: revoga o EXECUTE implícito de PUBLIC
-- (Postgres concede por padrão na criação) e reconcede só o necessário.
-- ==============================================================================

revoke all on all routines in schema public from public, anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Desfaz também os GRANT ALL históricos em DEFAULT PRIVILEGES: objetos futuros
-- não herdam acesso para anon/authenticated sem grant explícito.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Helpers usados por policies e pelo app.
grant execute on function public.current_profile() to authenticated, service_role;
grant execute on function public.is_active_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_admin(uuid) to authenticated, service_role;

-- RPCs públicas da aplicação.
grant execute on function public.ensure_current_user_profile() to authenticated, service_role;
grant execute on function public.issue_quote(uuid, integer) to authenticated, service_role;
grant execute on function public.cancel_quote(uuid, text) to authenticated, service_role;
grant execute on function public.save_quote_draft(uuid, integer, jsonb, jsonb, uuid) to authenticated, service_role;
grant execute on function public.update_organization_settings(jsonb) to authenticated, service_role;
grant execute on function public.admin_provision_seller(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_update_profile(uuid, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.quote_metrics() to authenticated, service_role;

grant select on public.quote_list to authenticated;

commit;

