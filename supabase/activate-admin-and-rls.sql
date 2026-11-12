-- ==============================================================================
-- BLOQUEADO — SCRIPT HISTÓRICO SEM EFEITO
-- ==============================================================================
-- Problemas do conteúdo anterior:
--   * permitia ao usuário atualizar role/organization_id/active do próprio perfil;
--   * promovia perfil a admin por conveniência;
--   * usava RAISE NOTICE fora de bloco PL/pgSQL (erro de sintaxe);
--   * reescrevia policies sem checar active.
--
-- Não execute. Use:
--   supabase/migrations/20261111153000_security_and_integrity_hardening.sql
--
-- A promoção a admin agora é operação administrativa explícita
-- (RPC admin_update_profile), com auditoria e checagem de admin ativo.
-- ==============================================================================

select 'Script substituído pela migration 20261111153000_security_and_integrity_hardening.sql' as aviso;
