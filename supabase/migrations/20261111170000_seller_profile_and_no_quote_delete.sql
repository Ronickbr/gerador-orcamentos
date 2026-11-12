-- ==============================================================================
-- MIGRATION: Edição de perfil do vendedor e proibição de exclusão de orçamentos
-- Data: 2026-11-11
--
-- 1. Proíbe expressamente que vendedores excluam orçamentos:
--    Remove policy "quotes_delete_own_draft" que permitia delete de rascunhos por vendedores.
--    Apenas administradores podem excluir rascunhos (ou nenhum delete direto).
-- 2. Atualiza a RPC "cancel_quote":
--    Permite cancelar qualquer orçamento ativo (draft, issued, expired).
--    O registro permanece intacto no banco de dados com status 'cancelled',
--    registrando motivo, data e quem cancelou.
-- 3. Cria a RPC "update_my_profile":
--    Permite que qualquer usuário autenticado e ativo edite seu nome e telefone.
-- ==============================================================================

begin;

-- 1. Remoção da política que permitia vendedores deletarem seus rascunhos
drop policy if exists "quotes_delete_own_draft" on public.quotes;

-- Apenas administradores da organização podem, em caso estrito de manutenção,
-- deletar rascunhos. Vendedores NUNCA podem excluir orçamentos.
create policy "quotes_delete_admin_only"
on public.quotes for delete to authenticated
using (
  public.is_org_admin(organization_id)
  and status = 'draft'
);

-- 2. Atualização da RPC cancel_quote para permitir cancelar rascunhos, emitidos e expirados
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

  -- Permite cancelar orçamentos em rascunho, emitidos ou expirados
  if v_quote.status not in ('draft', 'issued', 'expired') then
    raise exception 'Status do orçamento inválido para cancelamento';
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
    jsonb_build_object(
      'reason', v_reason,
      'quote_number', v_quote.quote_number,
      'previous_status', v_quote.status
    )
  );

  return jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'version', v_quote.version + 1
  );
end;
$$;

grant execute on function public.cancel_quote(uuid, text) to authenticated, service_role;

-- 3. Criação da RPC update_my_profile para edição do perfil do usuário logado
create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_clean_name text;
  v_clean_phone text;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida';
  end if;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  if length(v_clean_name) < 2 then
    raise exception 'O nome deve ter ao menos 2 caracteres';
  end if;

  v_clean_phone := nullif(btrim(coalesce(p_phone, '')), '');

  update public.profiles
     set full_name = v_clean_name,
         phone = v_clean_phone,
         updated_at = now()
   where id = v_user_id
     and active = true
  returning * into v_profile;

  if not found then
    raise exception 'Perfil não encontrado ou usuário inativo';
  end if;

  return jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_profile)
  );
end;
$$;

grant execute on function public.update_my_profile(text, text) to authenticated, service_role;

commit;

