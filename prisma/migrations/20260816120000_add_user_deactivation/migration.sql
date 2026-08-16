-- Desativação administrativa de conta.
--
-- O painel de admin passa a ter duas ações distintas sobre uma conta:
--
--   Desativar  — reversível. Os dados continuam todos no banco; o que muda é
--                que o login é recusado e as sessões abertas caem. Serve para
--                o dia a dia: suspender um abuso, conter uma conta suspeita,
--                parar um cliente sem destruir o histórico dele.
--
--   Apagar     — definitivo. Não precisa de coluna: é DELETE na linha, e as
--                relações já cascateiam (ver schema.prisma). As duas tabelas
--                financeiras — Affiliate e AffiliateSale — usam SetNull de
--                propósito, então o rastro contábil sobrevive à exclusão.
--
-- Estas colunas existem só para a primeira ação. Todas são NULL nas linhas já
-- existentes, que é exatamente o estado "conta normal" — nenhuma conta em uso
-- muda de comportamento com esta migration.

-- Quando a conta foi desativada. NULL = conta normal. É este campo, e só ele,
-- que decide se o acesso está bloqueado — os dois abaixo são informativos.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

-- Motivo escrito pelo admin. Vai para a tela de login do próprio usuário, para
-- que ele saiba por que não entra em vez de achar que a senha quebrou.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedReason" TEXT;

-- Quem desativou. Guardado como texto solto, não como chave estrangeira: se o
-- admin que executou a ação for apagado depois, este registro precisa
-- sobreviver para a auditoria continuar fazendo sentido.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedById" TEXT;

-- Listar contas desativadas é a consulta natural do painel, e a coluna é
-- esparsa (a esmagadora maioria das linhas é NULL) — daí o índice parcial,
-- que indexa só o que interessa em vez da tabela inteira.
CREATE INDEX IF NOT EXISTS "User_deactivatedAt_idx"
  ON "User" ("deactivatedAt")
  WHERE "deactivatedAt" IS NOT NULL;
