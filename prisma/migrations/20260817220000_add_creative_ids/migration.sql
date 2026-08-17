-- Identificadores de campanha, conjunto e anúncio.
--
-- Hoje o `fbclid` prova que o clique veio da Meta, mas não diz de QUAL anúncio.
-- Como o `utm_campaign` costuma trazer o NOME da campanha (que o anunciante
-- renomeia livremente), não há chave estável para responder "qual criativo
-- gerou esta venda" — que é a pergunta que decide onde colocar dinheiro.
--
-- Estas colunas guardam os ids numéricos, estáveis e cruzáveis com a API da
-- Meta. São preenchidas pelas macros que a Meta substitui na URL do anúncio
-- ({{campaign.id}}, {{adset.id}}, {{ad.id}}) e também aceitam os equivalentes
-- de Google e TikTok, já que a coluna é só um identificador de origem.
--
-- Aditivas e nulas: visitas antigas continuam válidas, apenas sem o dado — ele
-- nunca chegou a ser capturado.
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "adsetId"    TEXT;
ALTER TABLE "TrackedLead" ADD COLUMN IF NOT EXISTS "adId"       TEXT;

-- "Qual anúncio mais vendeu" é um agrupamento por adId dentro de um período,
-- sempre no escopo de um usuário.
CREATE INDEX IF NOT EXISTS "TrackedLead_userId_adId_idx" ON "TrackedLead" ("userId", "adId");
