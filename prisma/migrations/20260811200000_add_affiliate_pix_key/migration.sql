-- Carteira financeira de afiliados — Fase 2, gap encontrado ao especificar
-- POST /api/affiliate/wallet/payout: o desenho (§9/§24.6) exige que a chave
-- Pix do saque venha do "cadastro do afiliado", nunca do corpo do pedido de
-- saque (evita que um cliente comprometido redirecione o Pix no ato do
-- saque) — mas nenhum campo para esse cadastro existia no schema até aqui.
--
-- Nullable de propósito: POST /wallet/payout rejeita com erro claro se ainda
-- não houver chave cadastrada, em vez de a coluna forçar um valor no momento
-- em que o Affiliate é criado (cadastro de chave é uma ação separada e
-- posterior, feita pelo próprio afiliado).

ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
