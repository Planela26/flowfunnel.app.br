-- Vínculo de LINK RASTREÁVEL por funil (idempotente — seguro reexecutar).
--
-- Guarda ["<TrackedSite.id>", ...]: quais links curtos pertencem a este funil.
--
-- É o vínculo mais direto para o card da Landing Page. Cada clique no link
-- grava um evento `link_click` com `metadata.siteId` (lib/tracking-link.ts),
-- então o visitante já carrega de qual link veio — e o filtro vale
-- retroativamente, sem reprocessar nada.
--
-- A alternativa que existia era cruzar `TrackedLead.campaignId` com o
-- `facebookCampaignId` do funil, mas isso exige que a URL do anúncio traga as
-- macros da Meta. Quem manda o link curto por WhatsApp, bio ou e-mail não tem
-- macro nenhuma, e ficaria sem separação.
--
-- NULL é o padrão e significa "sem filtro": nenhum funil existente muda de
-- número por causa desta migration.

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "trackedSiteIds" TEXT;
