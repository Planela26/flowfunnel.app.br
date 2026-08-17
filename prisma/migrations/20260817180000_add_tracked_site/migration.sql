-- Rastreamento por link, sem instalar código na landing page.
--
-- Até aqui o único método era o tracker.js colado no <head> do site do cliente.
-- Funciona e continua existindo (é o método avançado), mas exige saber editar
-- HTML — barreira que trava a maior parte dos clientes logo no primeiro passo.
--
-- Com esta tabela o cliente cadastra a URL da landing e recebe um link do
-- FlowSara para usar nos anúncios. Quem clica passa por /r/<slug>, que registra
-- a visita com as UTMs e redireciona para o site real.
--
-- O `slug` é o núcleo da segurança. O identificador do dono NUNCA aparece na
-- URL: se aparecesse, bastaria trocá-lo para registrar visitas na conta de
-- outro cliente. O slug é opaco e resolvido aqui no banco. O destino também sai
-- desta tabela, nunca da query string — o que impede usar o link do FlowSara
-- como redirecionador aberto para qualquer endereço.

CREATE TABLE IF NOT EXISTS "TrackedSite" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "lastVisitAt"    TIMESTAMP(3),
  "visitCount"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrackedSite_pkey" PRIMARY KEY ("id")
);

-- Único global: o slug é a chave que resolve o dono na hora do clique, então
-- não pode existir duas vezes nem entre clientes diferentes.
CREATE UNIQUE INDEX IF NOT EXISTS "TrackedSite_slug_key" ON "TrackedSite" ("slug");
CREATE INDEX IF NOT EXISTS "TrackedSite_userId_idx" ON "TrackedSite" ("userId");

-- Cascata: apagar a conta pelo painel leva junto os links dela. As visitas já
-- registradas vivem em TrackedLead/TrackedEvent, que têm a própria cascata.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrackedSite_userId_fkey'
  ) THEN
    ALTER TABLE "TrackedSite"
      ADD CONSTRAINT "TrackedSite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS: a tabela é lida pela rota pública /r/<slug>, que roda com o cliente
-- administrativo (sem tenant, como os webhooks). A gestão pelo painel passa
-- pelo cliente de tenant e filtra por userId no próprio código, como as demais
-- tabelas de tracking (TrackedLead, TrackedSession) já fazem hoje.
