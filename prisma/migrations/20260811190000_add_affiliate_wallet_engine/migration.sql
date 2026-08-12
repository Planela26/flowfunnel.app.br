-- Carteira financeira de afiliados — Fase 2 (engine de comissão/saldo).
--
-- Cria as funções Postgres SECURITY DEFINER que são a ÚNICA forma de mudar
-- AffiliateWallet.pendingBalance/availableBalance/reservedBalance/
-- lifetimeEarned/lifetimePaid — decisão final registrada em
-- AFFILIATE_WALLET_ARCHITECTURE.md §24.1 (linhas 1507-1567), substituindo a
-- alternativa mais simples de "disciplina de código" a pedido explícito do
-- dono do produto, para reforçar a garantia no próprio banco.
--
-- Cada função: (1) insere a(s) linha(s) de AffiliateLedgerEntry correspondente(s)
-- via idempotencyKey único (ON CONFLICT DO NOTHING — replay seguro), e (2), só
-- se a inserção realmente aconteceu, aplica o UPDATE correspondente no wallet.
-- As duas coisas sempre na MESMA execução da função — nunca passos separados
-- (§24.2, regra de atomicidade).
--
-- IDs e idempotencyKeys são gerados em TypeScript (crypto.randomUUID(), mesmo
-- padrão já usado em lib/security-utils.ts para RateLimit) e passados como
-- parâmetro — evita depender de uma extensão de geração de UUID no Postgres
-- que pode não estar habilitada nesta base.
--
-- Dono da função = role que roda esta migration (DATABASE_URL, mesma role
-- dona das tabelas) — SECURITY DEFINER executa com esse privilégio,
-- independente de quem chama (app_rls só precisa de EXECUTE, nunca de
-- UPDATE direto nas colunas de saldo — já revogado em
-- 20260811150000_add_affiliate_wallet_rls). Na prática a engine roda sempre
-- via `prismaAdmin` (bypassa RLS por completo, é superuser) — estas funções
-- são a barreira estrutural para qualquer caminho de código futuro que,
-- por engano, tentasse escrever saldo pelo client de tenant.

-- ============================================================================
-- 1) accrue_commission — nascimento da comissão. Linha única (dinheiro novo).
--    PENDING += amount, lifetimeEarned += amount.
-- ============================================================================

CREATE OR REPLACE FUNCTION accrue_commission(
  p_id text,
  p_affiliate_id text,
  p_commission_id text,
  p_amount numeric,
  p_idempotency_key text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inserted_id text;
BEGIN
  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "commissionId", "idempotencyKey", "createdAt")
  VALUES
    (p_id, p_affiliate_id, 'PENDING', p_amount, 'COMMISSION_ACCRUE', p_commission_id, p_idempotency_key, now())
  ON CONFLICT ("idempotencyKey") DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Replay do mesmo evento (idempotência) — nenhuma mudança de saldo.
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE "AffiliateWallet" AS w
    SET "pendingBalance" = w."pendingBalance" + p_amount,
        "lifetimeEarned" = w."lifetimeEarned" + p_amount,
        "updatedAt" = now()
    WHERE w."affiliateId" = p_affiliate_id
    RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance";
END;
$$;

-- ============================================================================
-- 2) mature_commission — PENDING → AVAILABLE (par, 2 linhas, mesmo transferGroupId).
-- ============================================================================

CREATE OR REPLACE FUNCTION mature_commission(
  p_debit_id text,
  p_credit_id text,
  p_affiliate_id text,
  p_commission_id text,
  p_amount numeric,
  p_transfer_group_id text,
  p_idempotency_key_debit text,
  p_idempotency_key_credit text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "transferGroupId", "commissionId", "idempotencyKey", "createdAt")
  VALUES
    (p_debit_id,  p_affiliate_id, 'PENDING',   -p_amount, 'COMMISSION_MATURE', p_transfer_group_id, p_commission_id, p_idempotency_key_debit,  now()),
    (p_credit_id, p_affiliate_id, 'AVAILABLE',  p_amount, 'COMMISSION_MATURE', p_transfer_group_id, p_commission_id, p_idempotency_key_credit, now())
  ON CONFLICT ("idempotencyKey") DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  IF v_count != 2 THEN
    RAISE EXCEPTION 'mature_commission: inserção parcial de ledger (% de 2 linhas) para commissionId=%', v_count, p_commission_id;
  END IF;

  RETURN QUERY
    UPDATE "AffiliateWallet" AS w
    SET "pendingBalance"   = w."pendingBalance" - p_amount,
        "availableBalance" = w."availableBalance" + p_amount,
        "updatedAt" = now()
    WHERE w."affiliateId" = p_affiliate_id
    RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance";
END;
$$;

-- ============================================================================
-- 3) reverse_commission — refund/chargeback. Linha única (dinheiro sai do
--    sistema de verdade, não é transferência interna). Debita a conta onde a
--    comissão estiver hoje (PENDING ou AVAILABLE, decidido pelo chamador a
--    partir do status já lido). availableBalance pode ficar negativo por
--    desenho (Decisão E) — sem WHERE de saldo mínimo nesta função.
--    lifetimeEarned também é decrementado quando a conta é AVAILABLE/PENDING,
--    para refletir que o valor nunca foi de fato ganho (escolha desta
--    implementação, não estava explícita no documento — reversível se o
--    produto preferir manter lifetimeEarned histórico intocado).
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_commission(
  p_id text,
  p_affiliate_id text,
  p_commission_id text,
  p_amount numeric,
  p_account text,
  p_reason text,
  p_idempotency_key text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inserted_id text;
BEGIN
  IF p_account NOT IN ('PENDING', 'AVAILABLE') THEN
    RAISE EXCEPTION 'reverse_commission: conta inválida %', p_account;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reverse_commission: reason é obrigatório';
  END IF;

  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "commissionId", "reason", "idempotencyKey", "createdAt")
  VALUES
    (p_id, p_affiliate_id, p_account::"LedgerAccount", -p_amount, 'COMMISSION_REVERSE', p_commission_id, p_reason, p_idempotency_key, now())
  ON CONFLICT ("idempotencyKey") DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  IF p_account = 'PENDING' THEN
    RETURN QUERY
      UPDATE "AffiliateWallet" AS w
      SET "pendingBalance" = w."pendingBalance" - p_amount,
          "lifetimeEarned" = w."lifetimeEarned" - p_amount,
          "updatedAt" = now()
      WHERE w."affiliateId" = p_affiliate_id
      RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance";
  ELSE
    RETURN QUERY
      UPDATE "AffiliateWallet" AS w
      SET "availableBalance" = w."availableBalance" - p_amount,
          "lifetimeEarned"   = w."lifetimeEarned" - p_amount,
          "updatedAt" = now()
      WHERE w."affiliateId" = p_affiliate_id
      RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance";
  END IF;
END;
$$;

-- ============================================================================
-- 4) reserve_payout_amount — AVAILABLE → RESERVED (par). Único ponto de
--    concorrência real: o UPDATE só afeta linha se availableBalance >= amount
--    (Seção 8). Se não afetar, o ledger sozinho já não teria sido inserido
--    coerentemente — por isso o INSERT do ledger só acontece DEPOIS de
--    confirmar que o UPDATE afetou uma linha (ordem invertida em relação às
--    outras funções, de propósito: aqui existe uma condição de negócio real
--    de "saldo insuficiente", não só idempotência).
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_payout_amount(
  p_debit_id text,
  p_credit_id text,
  p_affiliate_id text,
  p_payout_id text,
  p_amount numeric,
  p_transfer_group_id text,
  p_idempotency_key_debit text,
  p_idempotency_key_credit text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing_id text;
  v_pending numeric;
  v_available numeric;
  v_reserved numeric;
BEGIN
  -- Idempotência primeiro: se este payout já reservou (replay de request),
  -- não tenta reservar de novo.
  SELECT "id" INTO v_existing_id FROM "AffiliateLedgerEntry"
    WHERE "idempotencyKey" = p_idempotency_key_debit;
  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  UPDATE "AffiliateWallet" AS w
  SET "availableBalance" = w."availableBalance" - p_amount,
      "reservedBalance"  = w."reservedBalance" + p_amount,
      "updatedAt" = now()
  WHERE w."affiliateId" = p_affiliate_id
    AND w."availableBalance" >= p_amount
  RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance"
  INTO v_pending, v_available, v_reserved;

  IF NOT FOUND THEN
    -- Saldo insuficiente — resultado de negócio legítimo, não erro. 0 linhas,
    -- caller trata como "saldo insuficiente" (Seção 8/9).
    RETURN;
  END IF;

  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "transferGroupId", "payoutId", "idempotencyKey", "createdAt")
  VALUES
    (p_debit_id,  p_affiliate_id, 'AVAILABLE', -p_amount, 'PAYOUT_RESERVE', p_transfer_group_id, p_payout_id, p_idempotency_key_debit,  now()),
    (p_credit_id, p_affiliate_id, 'RESERVED',   p_amount, 'PAYOUT_RESERVE', p_transfer_group_id, p_payout_id, p_idempotency_key_credit, now());

  RETURN QUERY SELECT v_pending, v_available, v_reserved;
END;
$$;

-- ============================================================================
-- 5) release_payout_reservation — RESERVED → AVAILABLE (par). Cancelamento,
--    falha ou rejeição de payout.
-- ============================================================================

CREATE OR REPLACE FUNCTION release_payout_reservation(
  p_debit_id text,
  p_credit_id text,
  p_affiliate_id text,
  p_payout_id text,
  p_amount numeric,
  p_transfer_group_id text,
  p_idempotency_key_debit text,
  p_idempotency_key_credit text,
  p_reason text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "transferGroupId", "payoutId", "reason", "idempotencyKey", "createdAt")
  VALUES
    (p_debit_id,  p_affiliate_id, 'RESERVED',  -p_amount, 'PAYOUT_RELEASE', p_transfer_group_id, p_payout_id, p_reason, p_idempotency_key_debit,  now()),
    (p_credit_id, p_affiliate_id, 'AVAILABLE',  p_amount, 'PAYOUT_RELEASE', p_transfer_group_id, p_payout_id, p_reason, p_idempotency_key_credit, now())
  ON CONFLICT ("idempotencyKey") DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  IF v_count != 2 THEN
    RAISE EXCEPTION 'release_payout_reservation: inserção parcial de ledger (% de 2 linhas) para payoutId=%', v_count, p_payout_id;
  END IF;

  RETURN QUERY
    UPDATE "AffiliateWallet" AS w
    SET "reservedBalance"  = w."reservedBalance" - p_amount,
        "availableBalance" = w."availableBalance" + p_amount,
        "updatedAt" = now()
    WHERE w."affiliateId" = p_affiliate_id
      AND w."reservedBalance" >= p_amount
    RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'release_payout_reservation: reservedBalance insuficiente para liberar payoutId=%', p_payout_id;
  END IF;
END;
$$;

-- ============================================================================
-- 6) settle_payout — liquidação final. Linha única (dinheiro sai de verdade
--    via Pix). RESERVED -= amount, lifetimePaid += amount.
-- ============================================================================

CREATE OR REPLACE FUNCTION settle_payout(
  p_id text,
  p_affiliate_id text,
  p_payout_id text,
  p_amount numeric,
  p_idempotency_key text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inserted_id text;
BEGIN
  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "payoutId", "idempotencyKey", "createdAt")
  VALUES
    (p_id, p_affiliate_id, 'RESERVED', -p_amount, 'PAYOUT_SETTLE', p_payout_id, p_idempotency_key, now())
  ON CONFLICT ("idempotencyKey") DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE "AffiliateWallet" AS w
    SET "reservedBalance" = w."reservedBalance" - p_amount,
        "lifetimePaid"    = w."lifetimePaid" + p_amount,
        "updatedAt" = now()
    WHERE w."affiliateId" = p_affiliate_id
      AND w."reservedBalance" >= p_amount
    RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'settle_payout: reservedBalance insuficiente para liquidar payoutId=%', p_payout_id;
  END IF;
END;
$$;

-- ============================================================================
-- 7) apply_admin_adjustment — correção manual de admin. Linha única, reason
--    sempre obrigatório, qualquer uma das 3 contas. amount pode ser negativo
--    (débito) ou positivo (crédito) — quem decide o sinal é o chamador.
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_admin_adjustment(
  p_id text,
  p_affiliate_id text,
  p_account text,
  p_amount numeric,
  p_reason text,
  p_created_by text,
  p_idempotency_key text
) RETURNS TABLE("pendingBalance" numeric, "availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inserted_id text;
  v_column text;
BEGIN
  IF p_account NOT IN ('PENDING', 'AVAILABLE', 'RESERVED') THEN
    RAISE EXCEPTION 'apply_admin_adjustment: conta inválida %', p_account;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'apply_admin_adjustment: reason é obrigatório';
  END IF;
  IF p_created_by IS NULL OR length(trim(p_created_by)) = 0 THEN
    RAISE EXCEPTION 'apply_admin_adjustment: createdBy (adminId) é obrigatório';
  END IF;

  INSERT INTO "AffiliateLedgerEntry"
    ("id", "affiliateId", "account", "amount", "type", "reason", "createdBy", "idempotencyKey", "createdAt")
  VALUES
    (p_id, p_affiliate_id, p_account::"LedgerAccount", p_amount, 'ADJUSTMENT', p_reason, p_created_by, p_idempotency_key, now())
  ON CONFLICT ("idempotencyKey") DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN QUERY
      SELECT w."pendingBalance", w."availableBalance", w."reservedBalance"
      FROM "AffiliateWallet" w WHERE w."affiliateId" = p_affiliate_id;
    RETURN;
  END IF;

  v_column := CASE p_account
    WHEN 'PENDING'   THEN 'pendingBalance'
    WHEN 'AVAILABLE' THEN 'availableBalance'
    WHEN 'RESERVED'  THEN 'reservedBalance'
  END;

  -- Sem guarda de saldo mínimo aqui de propósito — um ADJUSTMENT é uma ação
  -- humana deliberada (admin já revisou o valor antes de confirmar). Para
  -- "reservedBalance", a CHECK de tabela (wallet_reserved_never_negative)
  -- ainda recusa um ajuste que deixaria a coluna negativa, só que com um erro
  -- genérico de constraint em vez de uma mensagem de domínio.
  RETURN QUERY EXECUTE format(
    'UPDATE "AffiliateWallet" AS w SET %1$I = w.%1$I + $1, "updatedAt" = now() WHERE w."affiliateId" = $2 RETURNING w."pendingBalance", w."availableBalance", w."reservedBalance"',
    v_column
  ) USING p_amount, p_affiliate_id;
END;
$$;

-- ============================================================================
-- 8) Privilégios — só EXECUTE, nunca UPDATE direto nas colunas de saldo.
-- ============================================================================

DO $$ BEGIN
  REVOKE UPDATE ("pendingBalance", "availableBalance", "reservedBalance", "lifetimeEarned", "lifetimePaid")
    ON "AffiliateWallet" FROM app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION accrue_commission(text, text, text, numeric, text) TO app_rls;
  GRANT EXECUTE ON FUNCTION mature_commission(text, text, text, text, numeric, text, text, text) TO app_rls;
  GRANT EXECUTE ON FUNCTION reverse_commission(text, text, text, numeric, text, text, text) TO app_rls;
  GRANT EXECUTE ON FUNCTION reserve_payout_amount(text, text, text, text, numeric, text, text, text) TO app_rls;
  GRANT EXECUTE ON FUNCTION release_payout_reservation(text, text, text, text, numeric, text, text, text, text) TO app_rls;
  GRANT EXECUTE ON FUNCTION settle_payout(text, text, text, numeric, text) TO app_rls;
  GRANT EXECUTE ON FUNCTION apply_admin_adjustment(text, text, text, numeric, text, text, text) TO app_rls;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
