// Carteira financeira de afiliados — engine de comissão/saldo (Fase 2).
//
// Único módulo autorizado a mover dinheiro entre AffiliateWallet/
// AffiliateLedgerEntry/AffiliateCommission/AffiliatePayout. Nenhuma rota deve
// chamar prismaAdmin.affiliateWallet.update(...) diretamente — sempre por
// aqui. Toda escrita financeira roda via `prismaAdmin` (bypassa RLS, mesmo
// padrão já usado por webhooks/cron/admin neste projeto — lib/prisma.ts) e
// dentro das funções Postgres SECURITY DEFINER criadas em
// prisma/migrations/20260811190000_add_affiliate_wallet_engine — ver esse
// arquivo para o desenho completo de cada função. Decisões de negócio A-G e
// especificação completa em AFFILIATE_WALLET_ARCHITECTURE.md §23-24.
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prismaAdmin } from './prisma'

export const RETENTION_DAYS = 15 // Decisão D
export const MIN_PAYOUT_AMOUNT = 100 // Decisão F

export class InsufficientBalanceError extends Error {
  constructor() {
    super('Saldo disponível insuficiente')
    this.name = 'InsufficientBalanceError'
  }
}

type WalletBalances = {
  pendingBalance: Prisma.Decimal
  availableBalance: Prisma.Decimal
  reservedBalance: Prisma.Decimal
}

function roundHalfUp2(amount: number): number {
  return Math.round(amount * 100) / 100
}

function requireWalletRow(rows: WalletBalances[], context: string): WalletBalances {
  if (rows.length === 0) {
    // AffiliateWallet deveria sempre existir (criado junto com o Affiliate —
    // ver createAffiliateWithWallet). Se isso disparar, é bug de dados, não
    // caminho de negócio esperado.
    throw new Error(`affiliate-ledger: AffiliateWallet ausente (${context})`)
  }
  return rows[0]
}

// ────────────────────────────────────────────────────────────────────────
// Criação de afiliado — wallet zerada no mesmo instante (§3.1), nunca sob
// demanda na primeira comissão.
// ────────────────────────────────────────────────────────────────────────
export async function createAffiliateWithWallet(
  data: Prisma.AffiliateCreateInput,
): Promise<Prisma.AffiliateGetPayload<{ include: { wallet: true } }>> {
  return prismaAdmin.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.create({ data })
    await tx.affiliateWallet.create({ data: { affiliateId: affiliate.id } })
    return tx.affiliate.findUniqueOrThrow({
      where: { id: affiliate.id },
      include: { wallet: true },
    })
  })
}

// ────────────────────────────────────────────────────────────────────────
// Nascimento da comissão — cria Sale + Commission + COMMISSION_ACCRUE numa
// única transação (§24.2, regra de atomicidade). Idempotente por
// (processor, externalPaymentId): uma segunda chamada para a mesma venda
// devolve a venda já existente em vez de duplicar (§6).
//
// Chamada hoje pela rota administrativa manual (app/api/affiliates/sale) e,
// a partir da Fase 4/5, pelos handlers de webhook Stripe/MP — mesma função,
// gatilhos diferentes (§4.0-4.2 do desenho).
// ────────────────────────────────────────────────────────────────────────
export type CreateCommissionInput = {
  affiliateId: string
  userId?: string | null
  processor: 'STRIPE' | 'MERCADOPAGO'
  externalPaymentId: string
  externalSubscriptionId?: string | null
  type: 'INITIAL' | 'RENEWAL'
  plan: string
  originalAmount: number
  discountedAmount: number
}

export async function createCommissionFromSale(input: CreateCommissionInput) {
  const existing = await prismaAdmin.affiliateSale.findUnique({
    where: {
      processor_externalPaymentId: {
        processor: input.processor,
        externalPaymentId: input.externalPaymentId,
      },
    },
    include: { commission: true },
  })
  if (existing) return { sale: existing, created: false as const }

  const affiliate = await prismaAdmin.affiliate.findUnique({
    where: { id: input.affiliateId },
    select: { commissionPercent: true },
  })
  if (!affiliate) throw new Error('Afiliado não encontrado')

  const commissionPercent = Number(affiliate.commissionPercent)
  // ROUND_HALF_UP em 2 casas — Decisão C.
  const commissionAmount = roundHalfUp2((input.discountedAmount * commissionPercent) / 100)
  const maturesAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const sale = await prismaAdmin.$transaction(async (tx) => {
    const createdSale = await tx.affiliateSale.create({
      data: {
        affiliateId: input.affiliateId,
        userId: input.userId || null,
        processor: input.processor,
        externalPaymentId: input.externalPaymentId,
        externalSubscriptionId: input.externalSubscriptionId || null,
        type: input.type,
        plan: input.plan,
        originalAmount: input.originalAmount,
        discountedAmount: input.discountedAmount,
      },
    })
    const commission = await tx.affiliateCommission.create({
      data: {
        saleId: createdSale.id,
        affiliateId: input.affiliateId,
        amount: commissionAmount,
        commissionPercentSnapshot: commissionPercent,
        maturesAt,
      },
    })

    const walletRows = await tx.$queryRaw<WalletBalances[]>`
      SELECT * FROM accrue_commission(
        ${crypto.randomUUID()}, ${input.affiliateId}, ${commission.id},
        ${commissionAmount}, ${`accrue:${commission.id}`}
      )
    `
    requireWalletRow(walletRows, `accrue commissionId=${commission.id}`)

    return tx.affiliateSale.findUniqueOrThrow({
      where: { id: createdSale.id },
      include: { commission: true },
    })
  })

  return { sale, created: true as const }
}

// ────────────────────────────────────────────────────────────────────────
// Maturação — PENDING → AVAILABLE. Chamada pelo cron (cron/affiliate-maturation,
// Fase 2) para toda AffiliateCommission com maturesAt <= now(). Idempotente e
// segura contra corrida com reverseCommission (§24.2, item 12).
// ────────────────────────────────────────────────────────────────────────
export async function matureCommission(commissionId: string) {
  return prismaAdmin.$transaction(async (tx) => {
    const { count } = await tx.affiliateCommission.updateMany({
      where: { id: commissionId, status: 'PENDING' },
      data: { status: 'AVAILABLE' },
    })
    if (count === 0) return { matured: false as const }

    const commission = await tx.affiliateCommission.findUniqueOrThrow({
      where: { id: commissionId },
      select: { affiliateId: true, amount: true },
    })
    const transferGroupId = crypto.randomUUID()
    const walletRows = await tx.$queryRaw<WalletBalances[]>`
      SELECT * FROM mature_commission(
        ${crypto.randomUUID()}, ${crypto.randomUUID()},
        ${commission.affiliateId}, ${commissionId}, ${commission.amount},
        ${transferGroupId},
        ${`mature:${commissionId}:debit`}, ${`mature:${commissionId}:credit`}
      )
    `
    requireWalletRow(walletRows, `mature commissionId=${commissionId}`)
    return { matured: true as const }
  })
}

// ────────────────────────────────────────────────────────────────────────
// Reversão completa — refund/chargeback confirmado. Debita a conta onde a
// comissão estiver hoje (PENDING ou AVAILABLE). Idempotente por
// idempotencyKey.
// ────────────────────────────────────────────────────────────────────────
export async function reverseCommission(
  commissionId: string,
  reason: string,
  idempotencyKey: string,
) {
  return prismaAdmin.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ affiliateId: string; amount: Prisma.Decimal; previous_status: string }[]>`
      UPDATE "AffiliateCommission" AS c
      SET status = 'REVERSED'
      FROM (SELECT status, "affiliateId", amount FROM "AffiliateCommission" WHERE id = ${commissionId}) AS prev
      WHERE c.id = ${commissionId} AND c.status IN ('PENDING', 'AVAILABLE')
      RETURNING prev."affiliateId", prev.amount, prev.status AS previous_status
    `
    if (rows.length === 0) return { reversed: false as const }

    const { affiliateId, amount, previous_status: account } = rows[0]
    const walletRows = await tx.$queryRaw<WalletBalances[]>`
      SELECT * FROM reverse_commission(
        ${crypto.randomUUID()}, ${affiliateId}, ${commissionId}, ${amount},
        ${account}, ${reason}, ${idempotencyKey}
      )
    `
    requireWalletRow(walletRows, `reverse commissionId=${commissionId}`)
    return { reversed: true as const, commission: rows[0] }
  })
}

// ────────────────────────────────────────────────────────────────────────
// Reversão proporcional — reembolso parcial. Calcula a proporção do valor
// reembolsado e reverte apenas essa parcela da comissão. Idempotente por
// refundId (§6, Decisão B — reembolso parcial). Protege contra:
// - Múltiplos refunds parciais somando até 100%
// - Tentativa de refund acima do valor original
// - Replay do mesmo refund (via idempotencyKey)
// ────────────────────────────────────────────────────────────────────────
export async function reverseCommissionPartially(params: {
  commissionId: string
  originalChargeAmount: number // O valor total original da cobrança (em centavos ou unidade base)
  refundedAmount: number // O valor reembolsado neste evento (mesma unidade)
  refundId: string // ID único do reembolso (Stripe refund.id, MP refund id, etc.)
  reason: string // Descrição do motivo
}) {
  const { commissionId, originalChargeAmount, refundedAmount, refundId, reason } = params

  // Validação básica
  if (originalChargeAmount <= 0 || refundedAmount <= 0) {
    throw new Error('originalChargeAmount e refundedAmount devem ser positivos')
  }
  if (refundedAmount > originalChargeAmount) {
    throw new Error(`refundedAmount (${refundedAmount}) não pode ultrapassar originalChargeAmount (${originalChargeAmount})`)
  }

  const idempotencyKey = `reverse-partial:${refundId}`

  return prismaAdmin.$transaction(async (tx) => {
    // Verificar se já existe reversão para este refund (idempotência)
    const existingEntry = await tx.affiliateLedgerEntry.findUnique({
      where: { idempotencyKey },
    })
    if (existingEntry) {
      return { reversedPartially: false as const, existingAmount: existingEntry.amount }
    }

    // Buscar a comissão original
    const commission = await tx.affiliateCommission.findUnique({
      where: { id: commissionId },
      select: { affiliateId: true, amount: true, status: true, saleId: true },
    })
    if (!commission) {
      throw new Error(`Comissão ${commissionId} não encontrada`)
    }

    // Buscar a venda para obter o valor original
    const sale = await tx.affiliateSale.findUnique({
      where: { id: commission.saleId },
      select: { originalAmount: true },
    })
    if (!sale) {
      throw new Error(`Venda associada à comissão não encontrada`)
    }

    // Calcular a proporção a reverter
    const proportion = new Prisma.Decimal(refundedAmount).div(originalChargeAmount)
    const amountToReverse = new Prisma.Decimal(commission.amount).mul(proportion)

    // Verificar que a soma de reembolsos não ultrapassa a comissão original
    const previousReversals = await tx.affiliateLedgerEntry.aggregate({
      where: {
        commissionId,
        type: 'COMMISSION_REVERSE',
      },
      _sum: { amount: true },
    })
    const totalReversed = (previousReversals._sum.amount ?? new Prisma.Decimal(0)).abs()
    const projectedTotal = totalReversed.add(amountToReverse)

    if (projectedTotal.gt(commission.amount)) {
      throw new Error(
        `Reembolsos acumulados (${projectedTotal}) não podem ultrapassar comissão original (${commission.amount})`,
      )
    }

    // Determinar de qual conta debitar (PENDING ou AVAILABLE)
    const account = commission.status === 'AVAILABLE' ? 'AVAILABLE' : 'PENDING'

    // Criar entrada de reversão no ledger
    await tx.affiliateLedgerEntry.create({
      data: {
        affiliateId: commission.affiliateId,
        account,
        amount: amountToReverse.mul(-1), // Negativo = débito
        type: 'COMMISSION_REVERSE',
        commissionId,
        idempotencyKey,
        reason: `${reason} (${refundedAmount}/${originalChargeAmount} = ${proportion.mul(100).toFixed(1)}%)`,
      },
    })

    // Atualizar o wallet (subtrai da conta correspondente)
    if (account === 'AVAILABLE') {
      await tx.$executeRaw`
        UPDATE "AffiliateWallet"
        SET "availableBalance" = "availableBalance" - ${amountToReverse}
        WHERE "affiliateId" = ${commission.affiliateId}
      `
    } else {
      await tx.$executeRaw`
        UPDATE "AffiliateWallet"
        SET "pendingBalance" = "pendingBalance" - ${amountToReverse}
        WHERE "affiliateId" = ${commission.affiliateId}
      `
    }

    return { reversedPartially: true as const, amountReversed: amountToReverse, proportion: proportion.toFixed(4) }
  })
}

// ────────────────────────────────────────────────────────────────────────
// Payout — solicitação. `amount` nunca é "quanto está disponível", só
// "quanto o afiliado deseja sacar" (§9) — a validação real é o UPDATE
// atômico condicional dentro de reserve_payout_amount(). Se o saldo não
// cobrir, a transação inteira é revertida (nenhum AffiliatePayout órfão).
// ────────────────────────────────────────────────────────────────────────
export async function reservePayout(params: {
  affiliateId: string
  amount: number
  pixKey: string
  idempotencyKey: string
}) {
  const existing = await prismaAdmin.affiliatePayout.findUnique({
    where: { affiliateId_idempotencyKey: { affiliateId: params.affiliateId, idempotencyKey: params.idempotencyKey } },
  })
  if (existing) return { payout: existing, created: false as const }

  try {
    return await prismaAdmin.$transaction(async (tx) => {
      const payout = await tx.affiliatePayout.create({
        data: {
          affiliateId: params.affiliateId,
          amount: params.amount,
          pixKey: params.pixKey,
          idempotencyKey: params.idempotencyKey,
        },
      })

      const transferGroupId = crypto.randomUUID()
      const walletRows = await tx.$queryRaw<WalletBalances[]>`
        SELECT * FROM reserve_payout_amount(
          ${crypto.randomUUID()}, ${crypto.randomUUID()},
          ${params.affiliateId}, ${payout.id}, ${params.amount},
          ${transferGroupId},
          ${`payout-reserve:${payout.id}:debit`}, ${`payout-reserve:${payout.id}:credit`}
        )
      `
      if (walletRows.length === 0) {
        // 0 linhas = saldo insuficiente (§8) — aborta a transação inteira,
        // o INSERT do payout acima é revertido junto.
        throw new InsufficientBalanceError()
      }

      return { payout, created: true as const }
    })
  } catch (e: any) {
    // Duas requisições idênticas (mesma idempotencyKey) de verdade
    // concorrentes podem ambas passar pelo `findUnique` acima antes de
    // qualquer uma commitar — a constraint única em (affiliateId,
    // idempotencyKey) garante que só uma das duas transações commita; a
    // outra recebe P2002 aqui. Tratada como replay idempotente (mesma
    // semântica do check antecipado), não como erro.
    if (e?.code === 'P2002') {
      const winner = await prismaAdmin.affiliatePayout.findUnique({
        where: { affiliateId_idempotencyKey: { affiliateId: params.affiliateId, idempotencyKey: params.idempotencyKey } },
      })
      if (winner) return { payout: winner, created: false as const }
    }
    throw e
  }
}

// ────────────────────────────────────────────────────────────────────────
// Payout — transições de estado. Toda transição é um UPDATE condicionado ao
// estado de origem (§24.5.1) — 0 linhas afetadas = transição inválida a
// partir do estado atual, tratado como 409 pela rota chamadora (retorna
// `null`), nenhum movimento de ledger é criado.
// ────────────────────────────────────────────────────────────────────────
type PayoutRow = Prisma.AffiliatePayoutGetPayload<{}>

async function transitionPayout(
  tx: Prisma.TransactionClient,
  payoutId: string,
  fromStatuses: string[],
  data: Prisma.AffiliatePayoutUpdateInput,
  extraWhere?: Prisma.AffiliatePayoutWhereInput,
): Promise<PayoutRow | null> {
  const { count } = await tx.affiliatePayout.updateMany({
    where: { id: payoutId, status: { in: fromStatuses as any }, ...extraWhere },
    data,
  })
  if (count === 0) return null
  return tx.affiliatePayout.findUniqueOrThrow({ where: { id: payoutId } })
}

export async function approvePayout(payoutId: string, adminId: string) {
  return prismaAdmin.$transaction(async (tx) => {
    return transitionPayout(tx, payoutId, ['REQUESTED'], {
      status: 'APPROVED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    })
  })
}

export async function cancelPayout(payoutId: string, affiliateId: string) {
  return prismaAdmin.$transaction(async (tx) => {
    const payout = await transitionPayout(
      tx,
      payoutId,
      ['REQUESTED'],
      { status: 'CANCELLED', reviewedAt: new Date() },
      { affiliateId },
    )
    if (!payout) return null
    await releaseReservation(tx, payout, null)
    return payout
  })
}

export async function rejectPayout(payoutId: string, adminId: string, reason: string) {
  return prismaAdmin.$transaction(async (tx) => {
    const payout = await transitionPayout(tx, payoutId, ['REQUESTED'], {
      status: 'REJECTED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      failureReason: reason,
    })
    if (!payout) return null
    await releaseReservation(tx, payout, reason)
    return payout
  })
}

export async function markPayoutFailed(payoutId: string, adminId: string, reason: string) {
  return prismaAdmin.$transaction(async (tx) => {
    const payout = await transitionPayout(tx, payoutId, ['APPROVED'], {
      status: 'FAILED',
      reviewedBy: adminId,
      failureReason: reason,
    })
    if (!payout) return null
    await releaseReservation(tx, payout, reason)
    return payout
  })
}

export async function markPayoutPaid(payoutId: string, adminId: string) {
  return prismaAdmin.$transaction(async (tx) => {
    const payout = await transitionPayout(tx, payoutId, ['APPROVED'], {
      status: 'PAID',
      reviewedBy: adminId,
      paidAt: new Date(),
    })
    if (!payout) return null

    const walletRows = await tx.$queryRaw<WalletBalances[]>`
      SELECT * FROM settle_payout(
        ${crypto.randomUUID()}, ${payout.affiliateId}, ${payout.id}, ${payout.amount},
        ${`payout-settle:${payout.id}`}
      )
    `
    requireWalletRow(walletRows, `settle payoutId=${payout.id}`)
    return payout
  })
}

async function releaseReservation(
  tx: Prisma.TransactionClient,
  payout: PayoutRow,
  reason: string | null,
) {
  const transferGroupId = crypto.randomUUID()
  const walletRows = await tx.$queryRaw<WalletBalances[]>`
    SELECT * FROM release_payout_reservation(
      ${crypto.randomUUID()}, ${crypto.randomUUID()},
      ${payout.affiliateId}, ${payout.id}, ${payout.amount},
      ${transferGroupId},
      ${`payout-release:${payout.id}:debit`}, ${`payout-release:${payout.id}:credit`},
      ${reason}
    )
  `
  requireWalletRow(walletRows, `release payoutId=${payout.id}`)
}

// ────────────────────────────────────────────────────────────────────────
// Ajuste manual de admin — qualquer conta, reason sempre obrigatório.
// ────────────────────────────────────────────────────────────────────────
export async function adjustBalance(params: {
  affiliateId: string
  account: 'PENDING' | 'AVAILABLE' | 'RESERVED'
  amount: number
  reason: string
  adminId: string
}) {
  if (!params.reason || !params.reason.trim()) {
    throw new Error('reason é obrigatório para ajuste manual')
  }
  return prismaAdmin.$transaction(async (tx) => {
    const walletRows = await tx.$queryRaw<WalletBalances[]>`
      SELECT * FROM apply_admin_adjustment(
        ${crypto.randomUUID()}, ${params.affiliateId}, ${params.account}, ${params.amount},
        ${params.reason}, ${params.adminId}, ${`adjustment:${crypto.randomUUID()}`}
      )
    `
    return requireWalletRow(walletRows, `adjustment affiliateId=${params.affiliateId}`)
  })
}
