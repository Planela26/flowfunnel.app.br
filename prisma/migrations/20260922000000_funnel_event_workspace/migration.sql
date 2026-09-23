-- O evento passa a saber de qual FUNIL ele é, decidido na chegada.
--
-- Idempotente de propósito: esta migration roda em banco que já tem dado, e
-- reexecutá-la não pode quebrar nada.

ALTER TABLE "FunnelEvent" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

-- A consulta de todo card de funil: "eventos deste funil, neste período".
CREATE INDEX IF NOT EXISTS "FunnelEvent_workspaceId_timestamp_idx"
  ON "FunnelEvent"("workspaceId", "timestamp");

-- SEM chave estrangeira para "Workspace" de propósito: apagar um funil não
-- pode apagar em cascata o histórico de vendas dele, nem impedir o apagamento.
-- O evento órfão vira "Sem funil", que é exatamente o que ele passou a ser.
