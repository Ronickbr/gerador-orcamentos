-- ==============================================================================
-- BLOQUEADO — SCRIPT HISTÓRICO SEM EFEITO
-- ==============================================================================
-- O conteúdo anterior concedia ALL em tabelas/funções/sequences do schema public
-- para anon, PUBLIC e authenticated, e criava default privileges com ALL. Isso
-- anula o RLS e expõe o banco inteiro à chave anônima.
--
-- Não execute. Privilégios corretos estão na migration:
--   supabase/migrations/20261111153000_security_and_integrity_hardening.sql
--
-- Regras aplicadas lá: anon sem acesso, sem escrita direta em quotes/itens/
-- auditoria, perfis e organização com colunas limitadas, RPCs explícitas.
-- ==============================================================================

select 'Script substituído pela migration 20261111153000_security_and_integrity_hardening.sql' as aviso;
