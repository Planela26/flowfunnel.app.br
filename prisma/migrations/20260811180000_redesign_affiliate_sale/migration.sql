-- Redesenho completo de AffiliateSale, conforme AFFILIATE_WALLET_ARCHITECTURE.md.
--
-- Autorizado pelo dono do produto após confirmar, via consulta somente-leitura
-- em produção, que a tabela está com 0 linhas e não há afiliado cadastrado —
-- portanto SEM backfill de dados históricos. Isso simplifica a migration:
-- colunas novas entram como NOT NULL diretamente, sem passo intermediário de
-- preenchimento.
--
-- NÃO ALTERA a policy de RLS existente (tenant_isolation, dupla condição
-- userId-da-venda OU Affiliate.userId) — ela não depende de nenhuma coluna
-- tocada aqui. NÃO ALTERA os grants de app_rls (INSERT+SELECT, já herdados
-- de antes deste projeto de carteira) — mudar isso não foi pedido nesta
-- rodada e a policy dupla sugere um uso legítimo (cliente vê a própria
-- compra) que não foi investigado a fundo para não arriscar quebrar algo
-- fora do escopo pedido.

-- ============================================================================
-- 1) Colunas novas — todas com dado suficiente para NOT NULL direto, já que
--    a tabela está vazia (sem UPDATE de backfill necessário).
-- ============================================================================

ALTER TABLE "AffiliateSale" ADD COLUMN IF NOT EXISTS "processor" "PaymentProcessor";
ALTER TABLE "AffiliateSale" ADD COLUMN IF NOT EXISTS "externalPaymentId" TEXT;
ALTER TABLE "AffiliateSale" ADD COLUMN IF NOT EXISTS "externalSubscriptionId" TEXT;
ALTER TABLE "AffiliateSale" ADD COLUMN IF NOT EXISTS "type" "SaleType";

-- Tabela confirmadamente vazia — não há linha para violar o NOT NULL.
ALTER TABLE "AffiliateSale" ALTER COLUMN "processor" SET NOT NULL;
ALTER TABLE "AffiliateSale" ALTER COLUMN "externalPaymentId" SET NOT NULL;
ALTER TABLE "AffiliateSale" ALTER COLUMN "type" SET NOT NULL;

-- ============================================================================
-- 2) Remove a chave única antiga (stripePaymentId) e a própria coluna —
--    substituída por processor+externalPaymentId, que cobre os dois
--    processadores de pagamento (Stripe e Mercado Pago) simetricamente.
-- ============================================================================

ALTER TABLE "AffiliateSale" DROP CONSTRAINT IF EXISTS "AffiliateSale_stripePaymentId_key";
ALTER TABLE "AffiliateSale" DROP COLUMN IF EXISTS "stripePaymentId";

-- Idempotência de domínio (Seção 6 do desenho): o mesmo pagamento do mesmo
-- processador nunca gera duas vendas.
DO $$ BEGIN
  ALTER TABLE "AffiliateSale" ADD CONSTRAINT "AffiliateSale_processor_externalPaymentId_key"
    UNIQUE ("processor", "externalPaymentId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3) commissionAmount sai da venda — a obrigação financeira mora só em
--    AffiliateCommission (Seção 1 do desenho: fato vs. obrigação separados).
--    Sem perda de dado real: tabela vazia, confirmado por consulta em
--    produção antes desta migration.
-- ============================================================================

ALTER TABLE "AffiliateSale" DROP COLUMN IF EXISTS "commissionAmount";

-- ============================================================================
-- 4) Float → Decimal, sem perda (tabela vazia — nenhum valor a converter).
-- ============================================================================

ALTER TABLE "AffiliateSale" ALTER COLUMN "originalAmount" TYPE numeric(12,2)
  USING "originalAmount"::numeric(12,2);
ALTER TABLE "AffiliateSale" ALTER COLUMN "discountedAmount" TYPE numeric(12,2)
  USING "discountedAmount"::numeric(12,2);

-- ============================================================================
-- 5) FK própria para User.userId (antes era uma coluna solta, sem
--    integridade referencial). SetNull: deleção de conta de cliente nunca
--    pode falhar por causa do histórico de venda de afiliado.
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE "AffiliateSale" ADD CONSTRAINT "AffiliateSale_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 6) Índices — troca o índice simples de affiliateId por composto com
--    createdAt (consulta típica: histórico ordenado por data), e adiciona
--    índice em userId (consulta do cliente pela própria compra, dado o
--    outro braço da policy de RLS).
-- ============================================================================

DROP INDEX IF EXISTS "AffiliateSale_affiliateId_idx";
DROP INDEX IF EXISTS "AffiliateSale_createdAt_idx";
CREATE INDEX IF NOT EXISTS "AffiliateSale_affiliateId_createdAt_idx" ON "AffiliateSale"("affiliateId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateSale_userId_idx" ON "AffiliateSale"("userId");
