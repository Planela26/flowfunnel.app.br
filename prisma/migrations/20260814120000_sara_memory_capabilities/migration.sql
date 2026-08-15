-- Memória da Sara.AI por plano.
--
-- A tabela já existia, mas guardava só (type, content, context, createdAt) e o
-- contexto carregava as 10 mais recentes para QUALQUER plano — inclusive FREE.
-- Com a memória virando diferencial comercial (START 3 / PRO 10 / SCALE 25),
-- selecionar por data já não serve: dentro de uma cota de 3, uma observação
-- trivial de ontem expulsava o objetivo declarado do negócio. Daí `importance`.
--
-- Todas as colunas são aditivas e têm default ou são nulas, então as linhas já
-- existentes continuam válidas e nenhuma memória de cliente é perdida. Este
-- arquivo é aplicado pelo pipeline no deploy; não foi rodado à mão contra o
-- banco de produção.

-- Relevância para caber na cota do plano. 'normal' preserva o comportamento
-- atual (ordenação por data) para tudo que já está gravado.
ALTER TABLE "SaraMemory" ADD COLUMN IF NOT EXISTS "importance" TEXT NOT NULL DEFAULT 'normal';

-- Origem do registro. O histórico existente foi todo criado pela heurística
-- `extractIntentions`, então 'auto' descreve corretamente o que já está lá.
ALTER TABLE "SaraMemory" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'auto';

-- Termos de busca. Nulo nas linhas antigas: a busca cai de volta para o
-- conteúdo quando não há keywords, sem quebrar memória já gravada.
ALTER TABLE "SaraMemory" ADD COLUMN IF NOT EXISTS "keywords" TEXT;

ALTER TABLE "SaraMemory" ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- Retenção por plano (START = 30 dias). NULL = não expira, que é o caso do
-- SCALE e também o comportamento correto para tudo que já existe: aplicar
-- retenção retroativa apagaria memória que o cliente já tinha.
ALTER TABLE "SaraMemory" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- DEFAULT now() é obrigatório aqui: a coluna é NOT NULL e a tabela tem linhas.
-- Sem o default, o ALTER falha no deploy.
ALTER TABLE "SaraMemory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Descartar expiradas e ordenar por relevância dentro da cota do plano.
CREATE INDEX IF NOT EXISTS "SaraMemory_userId_expiresAt_idx" ON "SaraMemory"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "SaraMemory_userId_importance_idx" ON "SaraMemory"("userId", "importance");
