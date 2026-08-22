-- Vínculo de PRODUTO por funil (idempotente — seguro reexecutar).
--
-- Cada funil passa a poder declarar quais produtos de checkout ele acompanha,
-- no formato {"hotmart":["8365536"],"kiwify":["abc"]}.
--
-- Antes desta coluna, as rotas de métrica de checkout consultavam apenas por
-- `userId`: criar um funil novo trazia junto o faturamento de todos os outros.
-- WhatsApp e Facebook já se separavam por `whatsappIntegrationId` e
-- `facebookCampaignId` — o checkout era a peça que faltava do mesmo desenho.
--
-- NULL é deliberado como padrão: significa "sem filtro, mostra tudo", que é
-- exatamente o comportamento anterior. Nenhum funil existente muda de número
-- por causa desta migration; só passa a existir a possibilidade de filtrar.

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "checkoutProductIds" TEXT;
