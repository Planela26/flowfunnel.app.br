-- Lembrete de PIX não pago.
--
-- Quando o cliente gera o QR e não paga, queremos mandar UM e-mail uma hora
-- depois. O Mercado Pago sabe se a cobrança foi paga; o que ele não sabe é se
-- nós já avisamos. Sem guardar isso, só há dois extremos: não avisar ninguém,
-- ou reavisar a cada passada do cron.
--
-- Daí esta tabela: uma linha por cobrança PIX gerada, com `remindedAt` nulo
-- até o aviso sair. O status de pagamento NÃO é guardado aqui de propósito —
-- é consultado no Mercado Pago na hora de enviar, para nunca cobrar quem já
-- pagou (que foi justamente o incômodo que originou este recurso).
--
-- O `qrCode` guarda o copia-e-cola para o e-mail levá-lo pronto. Não é
-- credencial: quem o tem consegue apenas PAGAR a cobrança.

CREATE TABLE IF NOT EXISTS "PixCharge" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "paymentId"  TEXT NOT NULL,
  "plan"       TEXT NOT NULL,
  "amount"     DECIMAL(12,2) NOT NULL,
  "qrCode"     TEXT,
  "ticketUrl"  TEXT,
  "remindedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PixCharge_pkey" PRIMARY KEY ("id")
);

-- Uma linha por pagamento: o checkout pode reenviar a mesma criação (retry,
-- duplo clique) e não queremos duas cobranças iguais gerando dois e-mails.
CREATE UNIQUE INDEX IF NOT EXISTS "PixCharge_paymentId_key" ON "PixCharge" ("paymentId");

-- A varredura do cron é sempre "não avisadas, criadas há mais de uma hora".
CREATE INDEX IF NOT EXISTS "PixCharge_remindedAt_createdAt_idx" ON "PixCharge" ("remindedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "PixCharge_userId_idx" ON "PixCharge" ("userId");

-- Cascata: apagar a conta pelo painel leva junto as cobranças pendentes dela.
-- Não há valor contábil aqui — o registro financeiro vive no Mercado Pago e,
-- do nosso lado, em AffiliateSale.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PixCharge_userId_fkey'
  ) THEN
    ALTER TABLE "PixCharge"
      ADD CONSTRAINT "PixCharge_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
