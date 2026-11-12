-- ==============================================================================
-- BLOQUEADO — SCRIPT HISTÓRICO SEM EFEITO
-- ==============================================================================
-- Este arquivo criava perfil automaticamente e promovia QUALQUER usuário
-- autenticado a admin ("ensure_current_user_profile"), e recriava policies que
-- removiam o isolamento por organização.
--
-- Não execute. A versão correta está em:
--   supabase/migrations/20261111153000_security_and_integrity_hardening.sql
--
-- Lá: provisionamento é negado quando não autorizado, papel nunca é promovido
-- por metadado do cadastro e as policies exigem organização + active.
-- ==============================================================================

select 'Script substituído pela migration 20261111153000_security_and_integrity_hardening.sql' as aviso;
