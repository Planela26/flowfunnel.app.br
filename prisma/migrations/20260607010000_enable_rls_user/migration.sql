-- ============================================================================
-- RLS para a tabela `User` — política self-only (cada tenant só enxerga/edita o
-- PRÓPRIO registro de usuário).
--
-- Antes desta migration, `User` ficava SEM RLS, então o cliente de tenant podia,
-- em tese, ler qualquer usuário (a proteção dependia só do filtro de aplicação).
-- Agora o isolamento é garantido no banco: `id = app.current_user_id`.
--
-- Leituras cross-user LEGÍTIMAS (checagem de e-mail já em uso e antifraude de
-- fingerprint de cartão) foram movidas para o cliente bypass (`prismaAdmin`), que
-- ignora RLS — ver app/api/account/email e app/api/stripe/activate-trial.
--
-- Escritas de sistema em `User` (NextAuth adapter, registro, webhooks, cron, admin)
-- já passam por `prismaAdmin` (bypass) e não são afetadas.
--
-- Idempotente.
-- ============================================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ("id" = current_setting('app.current_user_id', true))
  WITH CHECK ("id" = current_setting('app.current_user_id', true));
