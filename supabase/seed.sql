-- ==============================================================================
-- BLOQUEADO — SEED COM SENHA EM TEXTO CLARO E PROMOÇÃO A ADMIN
-- ==============================================================================
-- O conteúdo anterior redefinia a senha de admin@demo.com via SQL e promovia o
-- perfil a admin, ignorando o fluxo de Auth.
--
-- Para ambiente novo:
--   1. Aplique supabase/schema.sql.
--   2. Aplique supabase/migrations/20261111153000_security_and_integrity_hardening.sql.
--   3. Crie a organização (insert em organizations) com dados reais.
--   4. Crie o primeiro usuário em Authentication > Users.
--   5. Provisione o perfil com papel admin por RPC admin_provision_seller
--      (chamada autenticada de um admin) ou pela Admin API no servidor.
--
-- Nenhuma senha deve ficar em arquivo versionado.
-- ==============================================================================

select 'Seed bloqueado. Crie usuários pelo Auth e provisione perfis.' as aviso;
