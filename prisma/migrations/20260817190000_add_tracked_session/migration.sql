-- Tabela TrackedSession, que existia só no schema.
--
-- O modelo está em prisma/schema.prisma desde a criação do tracker, mas NENHUMA
-- migration jamais o criou — não aparece nem no 0_baseline. O banco tinha
-- TrackedLead, TrackedEvent e TrackedConversion, e não esta.
--
-- O estrago era silencioso e grande. Em app/api/track/event/route.ts a ordem é:
--
--   1. upsert em TrackedLead      → funcionava
--   2. upsert em TrackedSession   → estourava ("relation does not exist")
--   3. create em TrackedEvent     → nunca era alcançado
--
-- O tracker.js SEMPRE envia session_id, então o passo 2 sempre rodava e sempre
-- falhava. Resultado: as UTMs do visitante eram gravadas, mas nenhum evento —
-- nem page_view, nem click_whatsapp, nem click_checkout. E como
-- /api/track/stats conta eventos, o painel mostrava zero para quem tinha o
-- tracker instalado e funcionando. A rota respondia 500, mas o tracker envia
-- por sendBeacon e não trata resposta, então nada aparecia no navegador do
-- cliente.
--
-- Criar a tabela conserta o tracker existente e habilita o registro de sessão
-- do novo rastreamento por link, que grava nas mesmas tabelas.

CREATE TABLE IF NOT EXISTS "TrackedSession" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "visitorId" TEXT,
  "leadId"    TEXT NOT NULL,
  "firstUrl"  TEXT,
  "referrer"  TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeen"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrackedSession_pkey" PRIMARY KEY ("id")
);

-- Chave do upsert: uma linha por sessão de cada cliente.
CREATE UNIQUE INDEX IF NOT EXISTS "TrackedSession_userId_sessionId_key"
  ON "TrackedSession" ("userId", "sessionId");

CREATE INDEX IF NOT EXISTS "TrackedSession_userId_leadId_idx" ON "TrackedSession" ("userId", "leadId");
CREATE INDEX IF NOT EXISTS "TrackedSession_visitorId_idx"     ON "TrackedSession" ("visitorId");
CREATE INDEX IF NOT EXISTS "TrackedSession_startedAt_idx"     ON "TrackedSession" ("startedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrackedSession_userId_fkey'
  ) THEN
    ALTER TABLE "TrackedSession"
      ADD CONSTRAINT "TrackedSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
