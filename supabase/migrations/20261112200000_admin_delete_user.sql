-- ==============================================================================
-- MIGRATION: RPC para exclusão segura de usuário/vendedor por administrador
-- Data: 2026-11-12
-- ==============================================================================

create or replace function public.admin_delete_seller(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
  v_quote_count bigint;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.active or v_actor.role <> 'admin' then
    raise exception 'Apenas administradores ativos podem excluir usuários';
  end if;

  select * into v_target from public.profiles where id = p_profile_id;
  if not found or v_target.organization_id <> v_actor.organization_id then
    raise exception 'Usuário não encontrado nesta organização';
  end if;

  if p_profile_id = v_actor.id then
    raise exception 'Você não pode excluir seu próprio usuário';
  end if;

  select count(*) into v_quote_count from public.quotes where seller_user_id = p_profile_id;
  if v_quote_count > 0 then
    raise exception 'Este usuário possui % proposta(s) vinculada(s) e não pode ser excluído permanentemente para preservar o histórico comercial. Em vez disso, altere seu status para "Inativo".', v_quote_count;
  end if;

  delete from public.profiles where id = p_profile_id;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'user', p_profile_id::text, 'delete_user',
    jsonb_build_object('email', v_target.email, 'full_name', v_target.full_name)
  );

  return jsonb_build_object('success', true, 'deleted_id', p_profile_id);
end;
$$;

grant execute on function public.admin_delete_seller(uuid) to authenticated, service_role;

