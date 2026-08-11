-- Carteira financeira de afiliados — RLS das 4 tabelas novas + correção de
-- privilégios ficando mais restritivos do que a migration anterior
-- (20260811120000_add_affiliate_wallet_core).
--
-- Isolamento exigido por tabela (documentado antes de escrever qualquer
-- policy — ver mensagem de acompanhamento para a versão completa em prosa):
--   AffiliateWallet      — leitura própria; ZERO escrita via app_rls
--   AffiliateLedgerEntry — leitura própria; ZERO escrita via app_rls
--   AffiliateCommission  — leitura própria; ZERO escrita via app_rls
--   AffiliatePayout      — leitura própria; INSERT/UPDATE só do próprio
--                          affiliateId (solicitar/cancelar saque)
--
-- Princípio: zero confiança no frontend E zero confiança na aplicação
-- sozinha — a garantia real é o par (RLS + GRANT), testado neste banco de
-- teste com o mecanismo real (SET LOCAL ROLE app_rls), não só lido no SQL.
--
-- Correção em relação à migration anterior: lá eu tinha liberado INSERT no
-- ledger e UPDATE(status) na comissão para app_rls, presumindo que o motor
-- de comissão rodaria na sessão do afiliado. Reavaliando com o padrão já
-- estabelecido neste projeto (webhooks/cron/admin sempre usam prismaAdmin,
-- que ignora RLS e privilégios de app_rls por completo — lib/prisma.ts),
-- o motor nunca precisa de GRANT em app_rls. Revogo aqui.

-- ============================================================================
-- 1) RLS nas 4 tabelas — todas via EXISTS contra Affiliate.userId, mesmo
--    padrão já usado no projeto para tabelas filhas sem userId direto
--    (FunnelStage/FunnelEvent em 20260607000000_enable_rls).
-- ============================================================================

DO $$
DECLARE
  t text;
  affiliate_child_tables text[] := ARRAY[
    'AffiliateWallet', 'AffiliateLedgerEntry', 'AffiliateCommission', 'AffiliatePayout'
  ];
BEGIN
  FOREACH t IN ARRAY affiliate_child_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %1$I
        USING (EXISTS (
          SELECT 1 FROM "Affiliate" a
          WHERE a.id = %1$I."affiliateId"
            AND a."userId" = current_setting('app.current_user_id', true)
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM "Affiliate" a
          WHERE a.id = %1$I."affiliateId"
            AND a."userId" = current_setting('app.current_user_id', true)
        ))
    $f$, t);
  END LOOP;
END
$$;

-- ============================================================================
-- 2) Grants — mais restritivo que a migration anterior.
-- ============================================================================

-- AffiliateWallet: NENHUMA escrita para app_rls (ponto 9 do pedido — nem
-- mesmo o próprio saldo é editável pela sessão do afiliado).
DO $$ BEGIN
  REVOKE INSERT, UPDATE, DELETE ON "AffiliateWallet" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- AffiliateLedgerEntry: revoga também o INSERT (a migration anterior só
-- tinha revogado UPDATE/DELETE). Motor escreve via prismaAdmin.
DO $$ BEGIN
  REVOKE INSERT, UPDATE, DELETE ON "AffiliateLedgerEntry" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- AffiliateCommission: revoga o GRANT UPDATE(status) que a migration
-- anterior tinha concedido de volta. Motor escreve via prismaAdmin.
DO $$ BEGIN
  REVOKE INSERT, UPDATE, DELETE ON "AffiliateCommission" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- AffiliatePayout: mantém INSERT/UPDATE (self-service: solicitar/cancelar),
-- DELETE continua revogado desde a migration anterior. Nenhuma mudança
-- necessária aqui além da policy de RLS acima, que já restringe ao próprio
-- affiliateId tanto para leitura quanto para o WITH CHECK de escrita.

-- ============================================================================
-- 3) User.referredByAffiliateId — ponto 10 do pedido, e onde PAREI antes de
--    aplicar algo enganoso.
--
-- TENTEI: REVOKE UPDATE ("referredByAffiliateId") ON "User" FROM app_rls.
-- NÃO APLIQUEI: confirmei antes (grep em app/api) que dezenas de rotas já
-- fazem prisma.user.update() em muitas colunas diferentes (2FA, e-mail,
-- onboarding, senha, public-id, etc.) via este mesmo client com RLS — ou
-- seja, app_rls já tem GRANT UPDATE na tabela "User" inteira desde a
-- migration original de RLS. Um REVOKE de coluna sozinho, com esse GRANT de
-- tabela já existindo, não bloqueia nada (mesma classe de problema já
-- encontrada e corrigida em AffiliateCommission na migration anterior).
--
-- A correção de verdade (revogar UPDATE da tabela inteira e reconceder
-- coluna a coluna) exigiria eu enumerar e validar todas as colunas que
-- rotas hoje já escrevem legitimamente em User — trabalho real, mas fora do
-- escopo desta migration de RLS da carteira, e arriscado o suficiente para
-- não fazer sem pedido explícito.
--
-- Proteção real hoje, honesta: a mesma que já protege role/plan/
-- subscriptionStatus em User neste projeto — nenhuma rota aceita
-- referredByAffiliateId vindo do corpo da requisição (confirmado no desenho,
-- AFFILIATE_WALLET_ARCHITECTURE.md §18). É proteção de código, não de
-- banco, e fica registrada como limitação, não como algo resolvido aqui.
-- ============================================================================
