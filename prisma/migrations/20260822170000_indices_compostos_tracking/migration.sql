-- Índices compostos para TrackedLead e TrackedEvent (idempotente — seguro reexecutar).
--
-- Estas duas tabelas ficaram de fora da passada de 20260530000000_add_perf_indexes,
-- que aplicou exatamente este padrão em FunnelEvent e WebhookLog. TrackedSession,
-- criada na mesma época, TEM o composto. As três irmãs seguiram regras diferentes.
--
-- A consulta dominante nas duas é `{ userId, createdAt: { gte } }`, e nunca uma
-- das duas colunas sozinha. Com os índices separados o Postgres usa apenas um e
-- resolve o resto varrendo — o custo cresce junto com o histórico de cada conta.
--
-- Um índice em (a, b) atende também as consultas que filtram só por `a`, então
-- os avulsos que viram prefixo de um composto são derrubados: manter os dois
-- custa escrita em tabelas que recebem uma linha por visita rastreada, sem
-- comprar nada em leitura.
--
-- NOTA OPERACIONAL: CREATE INDEX (sem CONCURRENTLY) bloqueia ESCRITA na tabela
-- enquanto constrói. Não pode ser CONCURRENTLY porque `prisma migrate deploy`
-- roda a migration dentro de uma transação, e o Postgres proíbe a combinação.
-- Com o volume atual isso leva segundos; se estas tabelas crescerem muito antes
-- desta migration rodar, vale aplicá-la à mão com CONCURRENTLY fora do deploy.

-- ─────────────────────────── TrackedLead ───────────────────────────
CREATE INDEX IF NOT EXISTS "TrackedLead_userId_createdAt_idx"
  ON "TrackedLead"("userId", "createdAt");
DROP INDEX IF EXISTS "TrackedLead_userId_idx";

-- ─────────────────────────── TrackedEvent ──────────────────────────
-- Métricas e painéis: userId + janela de tempo.
CREATE INDEX IF NOT EXISTS "TrackedEvent_userId_createdAt_idx"
  ON "TrackedEvent"("userId", "createdAt");

-- Jornada do lead: userId + leadId.
CREATE INDEX IF NOT EXISTS "TrackedEvent_userId_leadId_idx"
  ON "TrackedEvent"("userId", "leadId");

-- Atribuição de venda (lib/attribution.ts): userId + eventName + janela,
-- ordenado por data. Roda a cada venda que entra.
CREATE INDEX IF NOT EXISTS "TrackedEvent_userId_eventName_createdAt_idx"
  ON "TrackedEvent"("userId", "eventName", "createdAt");

-- Superados pelos compostos acima (todos são prefixo de um deles).
DROP INDEX IF EXISTS "TrackedEvent_userId_idx";
DROP INDEX IF EXISTS "TrackedEvent_leadId_idx";
DROP INDEX IF EXISTS "TrackedEvent_eventName_idx";

-- "TrackedEvent_createdAt_idx" e "TrackedLead_createdAt_idx" ficam: servem
-- varredura entre contas (limpeza por retenção), que não filtra por usuário.
