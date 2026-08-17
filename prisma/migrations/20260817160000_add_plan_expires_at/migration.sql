-- Fim do período pago.
--
-- Até aqui nenhuma assinatura vencia. O webhook do Mercado Pago gravava
-- `subscriptionStatus = 'active'` quando o PIX era aprovado e nada, em lugar
-- nenhum do sistema, marcava uma assinatura como expirada — a busca por quem
-- grava 'expired' voltava vazia. Como `hasPaidAccess` libera na primeira linha
-- para status 'active', um pagamento avulso de R$ 47,90 dava acesso vitalício:
-- não vencia, não cobrava de novo e não bloqueava nunca.
--
-- Esta coluna guarda a data em que o período pago termina, gravada na aprovação
-- do pagamento como "agora + 30 dias". Ela também ancora o ciclo de cota: o
-- período corrente começa 30 dias antes dela, em vez do dia 1º do mês.
--
-- NULL nas linhas existentes, e NULL significa "sem período pago rastreado".
-- Isso preserva o comportamento atual de quem já pagou: ninguém é bloqueado
-- retroativamente por uma coluna que não existia quando comprou. Contas assim
-- passam a ter vencimento no próximo pagamento aprovado.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);

-- Listar quem está para vencer (ou já venceu) é a consulta natural de cobrança,
-- e a coluna é esparsa enquanto a base de pagantes for pequena — daí o índice
-- parcial, que indexa só as linhas com período pago.
CREATE INDEX IF NOT EXISTS "User_planExpiresAt_idx"
  ON "User" ("planExpiresAt")
  WHERE "planExpiresAt" IS NOT NULL;
