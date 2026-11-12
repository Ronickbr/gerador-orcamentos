-- ==============================================================================
-- BLOQUEADO — SCRIPT DESTRUTIVO, NÃO EXECUTE
-- ==============================================================================
-- O conteúdo anterior removia em cascata eventos, itens, orçamentos, perfil e
-- registros internos de auth.users para admin@demo.com.
--
-- Não execute. Se precisar remover um usuário, faça pela Admin API com
-- service_role no servidor, registrando a ação em audit_events, e confirme que
-- os orçamentos emitidos devem ser preservados (histórico comercial).
-- ==============================================================================

select 'Script destrutivo bloqueado.' as aviso;
