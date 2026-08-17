-- Tabela SaleAttribution, que existia só no schema.
--
-- Terceira ausência do mesmo tipo encontrada hoje (depois de TrackedSession e
-- das colunas de TrackedLead/Event/Conversion): o modelo está em
-- prisma/schema.prisma, nenhuma migration jamais o criou.
--
-- Esta é a mais séria das três, porque é o PRODUTO FINAL da atribuição.
-- `lib/attribution.ts` grava aqui o vínculo entre a venda e o clique que a
-- gerou — determinístico quando o lead_id volta no webhook da plataforma,
-- probabilístico quando o casamento é por e-mail, telefone ou janela de tempo.
-- É de onde sai a resposta para "esse cliente veio de qual anúncio".
--
-- Sem a tabela, `attributeSale()` estourava em TODA venda de cliente. E como
-- os handlers de webhook chamam essa função dentro de try/catch para não
-- derrubar o faturamento, o erro era engolido: a venda era registrada, o plano
-- liberado, e a atribuição silenciosamente perdida. Nenhuma venda jamais teve
-- origem identificada.
--
-- A tabela é criada vazia. As atribuições que se perderam não voltam — elas
-- nunca chegaram a existir. A partir daqui, cada nova venda passa a ser
-- atribuída.

CREATE TABLE IF NOT EXISTS "SaleAttribution" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "platform"      TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "leadId"        TEXT,
  "method"        TEXT NOT NULL,
  "matchedBy"     TEXT,
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "utmSource"     TEXT,
  "utmCampaign"   TEXT,
  "utmMedium"     TEXT,
  "utmContent"    TEXT,
  "fbclid"        TEXT,
  "gclid"         TEXT,
  "value"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"      TEXT NOT NULL DEFAULT 'BRL',
  "product"       TEXT,
  "buyerEmail"    TEXT,
  "buyerPhone"    TEXT,
  "metadata"      TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SaleAttribution_pkey" PRIMARY KEY ("id")
);

-- Uma atribuição por transação de cada plataforma. É esta chave que torna o
-- webhook idempotente: reenvio do mesmo evento faz upsert, não segunda venda.
CREATE UNIQUE INDEX IF NOT EXISTS "SaleAttribution_userId_platform_transactionId_key"
  ON "SaleAttribution" ("userId", "platform", "transactionId");

CREATE INDEX IF NOT EXISTS "SaleAttribution_userId_createdAt_idx" ON "SaleAttribution" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SaleAttribution_leadId_idx"           ON "SaleAttribution" ("leadId");
CREATE INDEX IF NOT EXISTS "SaleAttribution_method_idx"           ON "SaleAttribution" ("method");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SaleAttribution_userId_fkey'
  ) THEN
    ALTER TABLE "SaleAttribution"
      ADD CONSTRAINT "SaleAttribution_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
