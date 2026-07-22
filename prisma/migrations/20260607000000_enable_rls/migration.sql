-- ============================================================================
-- Row-Level Security (RLS) — isolamento absoluto por tenant (multi-tenant).
--
-- Estratégia: o app conecta como `postgres` (superuser + BYPASSRLS), que IGNORA
-- RLS. Para o RLS valer, as queries de tenant rodam dentro de uma transação que
-- executa `SET LOCAL ROLE app_rls` (role sem privilégio, NOBYPASSRLS) + define
-- `app.current_user_id`. O cliente bypass (`prismaAdmin`) NÃO troca de role e
-- permanece superuser (usado por auth, webhooks, cron, admin, fluxos públicos).
--
-- Fail-closed: sem `app.current_user_id` setado, `current_setting(...,true)`
-- retorna NULL/'' e nenhuma policy casa → 0 linhas (e WITH CHECK rejeita writes).
--
-- Idempotente: pode ser reaplicada com segurança (IF NOT EXISTS / DROP POLICY IF
-- EXISTS / FORCE).
-- ============================================================================

-- 1) Role sem privilégio usada pelo cliente de tenant ------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    CREATE ROLE app_rls NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

-- Garante que a role de conexão atual pode `SET ROLE app_rls`. Superuser já pode
-- trocar para qualquer role; o GRANT abaixo cobre o caso de a conexão NÃO ser
-- superuser (mas ter privilégio de admin sobre a role).
DO $$
BEGIN
  EXECUTE format('GRANT app_rls TO %I', current_user);
EXCEPTION WHEN OTHERS THEN
  -- Sem permissão para conceder (ou já é membro): ignora — superuser não precisa.
  NULL;
END
$$;

GRANT USAGE ON SCHEMA public TO app_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_rls;

-- 2) Tabelas isoladas por `userId` ------------------------------------------
DO $$
DECLARE
  t text;
  user_id_tables text[] := ARRAY[
    'TwoFactorRecoveryCode','PasswordResetToken','EmailVerificationToken',
    'MetricSnapshot','Account','Funnel','Integration','Goal','Notification',
    'WebhookLog','Workspace','Campaign','LeadStatus','TrackedLead',
    'TrackedEvent','TrackedConversion'
  ];
BEGIN
  FOREACH t IN ARRAY user_id_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("userId" = current_setting('app.current_user_id', true))
        WITH CHECK ("userId" = current_setting('app.current_user_id', true))
    $f$, t);
  END LOOP;
END
$$;

-- 3) TeamMember → isolado por ownerId ---------------------------------------
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TeamMember";
CREATE POLICY tenant_isolation ON "TeamMember"
  USING ("ownerId" = current_setting('app.current_user_id', true))
  WITH CHECK ("ownerId" = current_setting('app.current_user_id', true));

-- 4) AuditLog → isolado por tenantId (logs de sistema têm tenantId NULL e ficam
--    invisíveis para tenants; são escritos/lidos via prismaAdmin) -----------
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" = current_setting('app.current_user_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_user_id', true));

-- 5) Tabelas filhas de Funnel (sem userId direto) → via EXISTS no pai --------
DO $$
DECLARE
  t text;
  child_tables text[] := ARRAY['FunnelStage','FunnelEvent'];
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %1$I
        USING (EXISTS (
          SELECT 1 FROM "Funnel" f
          WHERE f.id = %1$I."funnelId"
            AND f."userId" = current_setting('app.current_user_id', true)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM "Funnel" f
          WHERE f.id = %1$I."funnelId"
            AND f."userId" = current_setting('app.current_user_id', true)
        ))
    $f$, t);
  END LOOP;
END
$$;

-- 6) Afiliados --------------------------------------------------------------
-- Affiliate: por userId (afiliados externos têm userId NULL → invisíveis a tenants,
-- geridos via prismaAdmin nos fluxos públicos).
ALTER TABLE "Affiliate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Affiliate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Affiliate";
CREATE POLICY tenant_isolation ON "Affiliate"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

-- AffiliateClick: pertence ao tenant dono do Affiliate referenciado.
ALTER TABLE "AffiliateClick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateClick" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AffiliateClick";
CREATE POLICY tenant_isolation ON "AffiliateClick"
  USING (EXISTS (
    SELECT 1 FROM "Affiliate" a
    WHERE a.id = "AffiliateClick"."affiliateId"
      AND a."userId" = current_setting('app.current_user_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Affiliate" a
    WHERE a.id = "AffiliateClick"."affiliateId"
      AND a."userId" = current_setting('app.current_user_id', true)
  ));

-- AffiliateSale: visível ao usuário referenciado (userId) OU ao dono do Affiliate.
ALTER TABLE "AffiliateSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AffiliateSale" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AffiliateSale";
CREATE POLICY tenant_isolation ON "AffiliateSale"
  USING (
    "userId" = current_setting('app.current_user_id', true)
    OR EXISTS (
      SELECT 1 FROM "Affiliate" a
      WHERE a.id = "AffiliateSale"."affiliateId"
        AND a."userId" = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    "userId" = current_setting('app.current_user_id', true)
    OR EXISTS (
      SELECT 1 FROM "Affiliate" a
      WHERE a.id = "AffiliateSale"."affiliateId"
        AND a."userId" = current_setting('app.current_user_id', true)
    )
  );
