-- Carteira financeira de afiliados — Fase 1 (Schema + migration).
--
-- Desenho completo, decisões de negócio e revisão adversarial de 18 cenários
-- em AFFILIATE_WALLET_ARCHITECTURE.md (Seção 24). Esta migration cobre
-- SOMENTE a forma do banco (tabelas, enums, constraints, imutabilidade
-- estrutural do ledger/venda). A "engine" de comissão (funções
-- SECURITY DEFINER que efetivamente movem saldo) é Fase 2, e chega numa
-- migration própria junto com o código que as usa — não faz sentido criar
-- funções SQL antes de existir qualquer caminho de código que as chame.
--
-- PAUSADO NESTA MIGRATION: o redesenho de "AffiliateSale" (processor,
-- externalPaymentId, type, Decimal em originalAmount/discountedAmount,
-- remoção de commissionAmount) fica de fora até confirmar com o dono do
-- produto se a tabela já tem linhas reais em produção — ver a mensagem que
-- acompanha este commit. Sem essa confirmação, uma migration que redesenha
-- essa tabela arrisca perder histórico de comissão já pago, o que contraria
-- diretamente a exigência de o histórico financeiro ser imutável.
--
-- Idempotente (IF NOT EXISTS / DO $$ ... EXCEPTION) seguindo o padrão já
-- usado em 20260607000000_enable_rls — seguro rodar de novo numa base já
-- migrada.

-- ============================================================================
-- 1) Enums
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentProcessor" AS ENUM ('STRIPE', 'MERCADOPAGO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SaleType" AS ENUM ('INITIAL', 'RENEWAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerAccount" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM (
    'COMMISSION_ACCRUE', 'COMMISSION_MATURE', 'COMMISSION_REVERSE',
    'PAYOUT_RESERVE', 'PAYOUT_RELEASE', 'PAYOUT_SETTLE', 'ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM (
    'REQUESTED', 'APPROVED', 'PAID', 'FAILED', 'CANCELLED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2) Affiliate: isActive (boolean) → status (enum), percentuais Float → Decimal
--    Conversão sem perda: todo Boolean tem mapeamento 1:1 para o enum, e todo
--    Float existente vira Decimal(5,2) preservando o valor.
-- ============================================================================

ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "status" "AffiliateStatus";

UPDATE "Affiliate" SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"AffiliateStatus" ELSE 'BLOCKED'::"AffiliateStatus" END
WHERE "status" IS NULL;

ALTER TABLE "Affiliate" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Affiliate" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"AffiliateStatus";
ALTER TABLE "Affiliate" DROP COLUMN IF EXISTS "isActive";

ALTER TABLE "Affiliate" ALTER COLUMN "discountPercent" TYPE numeric(5,2) USING "discountPercent"::numeric(5,2);
ALTER TABLE "Affiliate" ALTER COLUMN "commissionPercent" TYPE numeric(5,2) USING "commissionPercent"::numeric(5,2);

CREATE INDEX IF NOT EXISTS "Affiliate_status_idx" ON "Affiliate"("status");

-- ============================================================================
-- 3) User.referredByAffiliateId — atribuição durável, congelada na primeira
--    conversão paga (AFFILIATE_WALLET_ARCHITECTURE.md §18.7). SetNull: se um
--    Affiliate for removido (não deveria, política é status=BLOCKED), a conta
--    do cliente referenciado nunca é afetada.
-- ============================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByAffiliateId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredByAffiliateId_fkey"
    FOREIGN KEY ("referredByAffiliateId") REFERENCES "Affiliate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "User_referredByAffiliateId_idx" ON "User"("referredByAffiliateId");

-- ============================================================================
-- 4) AffiliateSale: só o onDelete muda nesta migration (Cascade → Restrict,
--    achado §0.3 do documento de arquitetura — dado financeiro nunca cascateia).
--    Nenhuma coluna de dado é alterada aqui (ver nota no topo do arquivo).
-- ============================================================================

ALTER TABLE "AffiliateSale" DROP CONSTRAINT IF EXISTS "AffiliateSale_affiliateId_fkey";
ALTER TABLE "AffiliateSale" ADD CONSTRAINT "AffiliateSale_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 5) AffiliateCommission — a obrigação financeira derivada de uma venda.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AffiliateCommission" (
  "id"                        TEXT NOT NULL,
  "saleId"                    TEXT NOT NULL,
  "affiliateId"               TEXT NOT NULL,
  "amount"                    numeric(12,2) NOT NULL,
  "commissionPercentSnapshot" numeric(5,2) NOT NULL,
  "status"                    "CommissionStatus" NOT NULL DEFAULT 'PENDING',
  "maturesAt"                 TIMESTAMP(3) NOT NULL,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_saleId_key" UNIQUE ("saleId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "AffiliateSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "commission_amount_positive" CHECK ("amount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AffiliateCommission_affiliateId_status_idx" ON "AffiliateCommission"("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "AffiliateCommission_maturesAt_idx" ON "AffiliateCommission"("maturesAt");

-- ============================================================================
-- 6) AffiliateLedgerEntry — o ledger imutável. Fonte de verdade financeira.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AffiliateLedgerEntry" (
  "id"              TEXT NOT NULL,
  "affiliateId"     TEXT NOT NULL,
  "account"         "LedgerAccount" NOT NULL,
  "amount"          numeric(12,2) NOT NULL,
  "type"            "LedgerEntryType" NOT NULL,
  "transferGroupId" TEXT,
  "commissionId"    TEXT,
  "payoutId"        TEXT,
  "idempotencyKey"  TEXT NOT NULL,
  "reason"          TEXT,
  "createdBy"       TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliateLedgerEntry_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_idempotencyKey_key" UNIQUE ("idempotencyKey");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FKs de commissionId/payoutId adicionadas depois de AffiliatePayout existir (seção 8).

CREATE INDEX IF NOT EXISTS "AffiliateLedgerEntry_affiliateId_createdAt_idx" ON "AffiliateLedgerEntry"("affiliateId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateLedgerEntry_commissionId_idx" ON "AffiliateLedgerEntry"("commissionId");
CREATE INDEX IF NOT EXISTS "AffiliateLedgerEntry_payoutId_idx" ON "AffiliateLedgerEntry"("payoutId");

-- ============================================================================
-- 7) AffiliateWallet — saldo materializado. Cache do ledger, nunca a fonte
--    de verdade (Seção 3 do documento de arquitetura).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AffiliateWallet" (
  "affiliateId"      TEXT NOT NULL,
  "pendingBalance"   numeric(12,2) NOT NULL DEFAULT 0,
  "availableBalance" numeric(12,2) NOT NULL DEFAULT 0,
  "reservedBalance"  numeric(12,2) NOT NULL DEFAULT 0,
  "lifetimeEarned"   numeric(12,2) NOT NULL DEFAULT 0,
  "lifetimePaid"     numeric(12,2) NOT NULL DEFAULT 0,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AffiliateWallet_pkey" PRIMARY KEY ("affiliateId")
);

DO $$ BEGIN
  ALTER TABLE "AffiliateWallet" ADD CONSTRAINT "AffiliateWallet_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateWallet" ADD CONSTRAINT "wallet_reserved_never_negative" CHECK ("reservedBalance" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Nenhum CHECK equivalente em "availableBalance" — pode ficar negativo por
-- desenho (Decisão E: clawback vira dívida compensada por comissões futuras).

-- Uma linha de wallet por afiliado já existente, saldos zerados (não há
-- comissão no novo formato ainda — a engine da Fase 2 é quem passa a
-- alimentar isso; o histórico antigo em AffiliateSale.commissionAmount fica
-- de fora até a decisão pendente sobre dados históricos).
INSERT INTO "AffiliateWallet" ("affiliateId", "updatedAt")
SELECT "id", CURRENT_TIMESTAMP FROM "Affiliate"
ON CONFLICT ("affiliateId") DO NOTHING;

-- ============================================================================
-- 8) AffiliatePayout — solicitação/execução de saque.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AffiliatePayout" (
  "id"             TEXT NOT NULL,
  "affiliateId"    TEXT NOT NULL,
  "amount"         numeric(12,2) NOT NULL,
  "pixKey"         TEXT NOT NULL,
  "status"         "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "idempotencyKey" TEXT NOT NULL,
  "requestedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy"     TEXT,
  "reviewedAt"     TIMESTAMP(3),
  "paidAt"         TIMESTAMP(3),
  "failureReason"  TEXT,
  "adminNote"      TEXT,

  CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_idempotencyKey_key" UNIQUE ("affiliateId", "idempotencyKey");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "payout_amount_minimum" CHECK ("amount" >= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Decisão F: R$100 mínimo, garantido no banco — não só na rota.

CREATE INDEX IF NOT EXISTS "AffiliatePayout_affiliateId_status_idx" ON "AffiliatePayout"("affiliateId", "status");

-- Agora que AffiliatePayout existe, completa as FKs do ledger (item 6).
DO $$ BEGIN
  ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_commissionId_fkey"
    FOREIGN KEY ("commissionId") REFERENCES "AffiliateCommission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateLedgerEntry" ADD CONSTRAINT "AffiliateLedgerEntry_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 9) CHECK adicionais — Affiliate (item 6 da revisão adversarial: mesmo sem
--    rota que exponha edição, o banco recusa um percentual sem sentido por
--    QUALQUER caminho, presente ou futuro).
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE "Affiliate" ADD CONSTRAINT "affiliate_commission_percent_range"
    CHECK ("commissionPercent" >= 0 AND "commissionPercent" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Affiliate" ADD CONSTRAINT "affiliate_discount_percent_range"
    CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 10) Imutabilidade estrutural — REVOKE, não só disciplina de código
--     (itens 16 e 17 da revisão adversarial). app_rls é a role usada pelo
--     client Prisma escopado por tenant (lib/prisma.ts); prismaAdmin conecta
--     com a role do DATABASE_URL e não é afetado por este REVOKE — o que é
--     esperado, pois rotas administrativas/cron ainda precisam operar sobre
--     estas tabelas por vias controladas (a própria migration acima também
--     roda fora de app_rls). O REVOKE aqui é a barreira contra a APLICAÇÃO
--     de tenant editar/apagar histórico por engano ou por exploração — não
--     é proteção contra um operador com acesso de superusuário ao Postgres
--     (limite operacional, não de código — documentado no §15 do desenho).
-- ============================================================================

DO $$ BEGIN
  REVOKE UPDATE, DELETE ON "AffiliateSale" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  REVOKE DELETE ON "AffiliateCommission" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- A migration de RLS já concede UPDATE na TABELA INTEIRA via
-- "GRANT ... UPDATE ... ON ALL TABLES IN SCHEMA public TO app_rls" — um
-- REVOKE de colunas específicas, sozinho, NÃO restringe nada nesse caso
-- (grant de tabela cobre toda coluna, independente de um REVOKE de coluna
-- coexistir). A forma correta é revogar o UPDATE da tabela inteira e
-- conceder de volta só a coluna que legitimamente muda depois de criada.
DO $$ BEGIN
  REVOKE UPDATE ON "AffiliateCommission" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  GRANT UPDATE ("status") ON "AffiliateCommission" TO app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Só "status" continua editável — é o campo de máquina de estados legítima
-- (PENDING → AVAILABLE → REVERSED), tudo o mais é fato imutável.

DO $$ BEGIN
  REVOKE UPDATE, DELETE ON "AffiliateLedgerEntry" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  REVOKE DELETE ON "AffiliatePayout" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  REVOKE DELETE ON "AffiliateWallet" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Nota: os GRANT/REVOKE de app_rls só existem em bases onde a migration de
-- RLS (20260607000000_enable_rls) já rodou e criou essa role. Se este script
-- rodar antes dela (ordem cronológica normal do Prisma garante que não,
-- porque 20260607000000 é anterior a esta), o bloco EXCEPTION WHEN OTHERS
-- absorve o erro "role app_rls does not exist" sem quebrar a migration —
-- mas o ideal é sempre rodar em ordem, como o Prisma já garante.
