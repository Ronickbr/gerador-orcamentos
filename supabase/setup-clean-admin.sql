-- ==============================================================================
-- BLOQUEADO — SCRIPT DESTRUTIVO, NÃO EXECUTE
-- ==============================================================================
-- O conteúdo anterior apagava usuários de auth.users, identidades, sessões,
-- refresh tokens, perfis, orçamentos e eventos de auditoria para "destravar"
-- admin@demo.com, além de redefinir senha em texto claro.
--
-- Nada aqui apaga dados. Para criar um administrador:
--   1. Crie o usuário em Authentication > Users (Supabase Dashboard) ou pela
--      Admin API com a chave service_role no servidor.
--   2. Rode a migration 20261111153000_security_and_integrity_hardening.sql.
--   3. Como admin já existente, use a tela /admin/vendedores para provisionar
--      o perfil (RPC admin_provision_seller) com papel admin.
--
-- A recuperação de senha usa o fluxo de e-mail (resetPasswordForEmail), nunca
-- UPDATE direto em auth.users.
-- ==============================================================================

select 'Script destrutivo bloqueado. Use a migration e o fluxo de Auth.' as aviso;
