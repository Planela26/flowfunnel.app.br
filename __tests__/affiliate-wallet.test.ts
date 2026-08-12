/**
 * Testes de concorrência/idempotência da carteira financeira de afiliados
 * (Fase 2 — engine de comissão/saldo). Ver AFFILIATE_WALLET_ARCHITECTURE.md
 * §24.8 para a matriz completa; este arquivo cobre os itens que já têm
 * caminho de código na Fase 2 (motor + rotas de payout/admin) — os itens
 * ligados a webhook Stripe/MP (#7-9, #14-17, #22) ficam para a Fase 4/5,
 * quando esses handlers existirem.
 *
 * Roda com: `npx tsx __tests__/affiliate-wallet.test.ts`
 *
 * Usa o banco real de desenvolvimento. Cria um afiliado descartável e limpa
 * tudo via prismaAdmin no final.
 */
import { prismaAdmin } from '../lib/prisma'
import {
  createAffiliateWithWallet,
  createCommissionFromSale,
  matureCommission,
  reverseCommission,
  reservePayout,
  cancelPayout,
  rejectPayout,
  markPayoutFailed,
  approvePayout,
  markPayoutPaid,
  adjustBalance,
  InsufficientBalanceError,
} from '../lib/affiliate-ledger'

let passed = 0
let failed = 0

function check(name: string, cond: boolean) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

async function expectRejected(name: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    failed++
    console.error(`  ✗ ${name} (esperava rejeição, mas não rejeitou)`)
  } catch {
    passed++
    console.log(`  ✓ ${name}`)
  }
}

async function walletOf(affiliateId: string) {
  return prismaAdmin.affiliateWallet.findUniqueOrThrow({ where: { affiliateId } })
}

async function main() {
  const suffix = Date.now()

  const { id: affiliateId } = await createAffiliateWithWallet({
    name: 'Wallet Test',
    email: `wallet-test-${suffix}@test.local`,
    code: `WALLETTEST${suffix}`,
    discountPercent: 10,
    commissionPercent: 30,
    pixKey: 'wallet-test@pix.local',
  })
  let raceAffiliateId: string | null = null

  try {
    // === 1) Nascimento da comissão + idempotência de venda (#10) ==========
    console.log('\n[1] Nascimento da comissão')
    const saleInput = {
      affiliateId,
      processor: 'STRIPE' as const,
      externalPaymentId: `inv_${suffix}_1`,
      type: 'INITIAL' as const,
      plan: 'PRO',
      originalAmount: 147,
      discountedAmount: 147,
    }
    const first = await createCommissionFromSale(saleInput)
    check('primeira chamada cria venda+comissão', first.created && !!first.sale.commission)
    check(
      'comissão calculada via ROUND_HALF_UP(147 * 30%) = 44.10',
      Number(first.sale.commission!.amount) === 44.1,
    )

    let wallet = await walletOf(affiliateId)
    check('wallet.pendingBalance reflete a comissão nascida', Number(wallet.pendingBalance) === 44.1)
    check('wallet.lifetimeEarned reflete a comissão nascida', Number(wallet.lifetimeEarned) === 44.1)

    const second = await createCommissionFromSale(saleInput)
    check('segunda chamada (mesmo externalPaymentId) é no-op', !second.created)
    check('mesma comissão retornada (não duplicou)', second.sale.commission!.id === first.sale.commission!.id)

    const commissionCount = await prismaAdmin.affiliateCommission.count({ where: { affiliateId } })
    check('exatamente 1 AffiliateCommission para essa venda', commissionCount === 1)

    wallet = await walletOf(affiliateId)
    check('pendingBalance não dobrou no replay', Number(wallet.pendingBalance) === 44.1)

    // === 2) Maturação idempotente ==========================================
    console.log('\n[2] Maturação')
    const commissionId = first.sale.commission!.id
    const matured1 = await matureCommission(commissionId)
    check('primeira maturação promove PENDING->AVAILABLE', matured1.matured)

    wallet = await walletOf(affiliateId)
    check('pendingBalance zerou após maturação', Number(wallet.pendingBalance) === 0)
    check('availableBalance recebeu o valor maturado', Number(wallet.availableBalance) === 44.1)

    const matured2 = await matureCommission(commissionId)
    check('segunda maturação (mesma comissão) é no-op', !matured2.matured)

    wallet = await walletOf(affiliateId)
    check('availableBalance não dobrou no replay da maturação', Number(wallet.availableBalance) === 44.1)

    // === 3) Segunda venda para dar saldo suficiente para os testes de saque =
    console.log('\n[3] Segunda venda (saldo para testes de payout)')
    const secondSale = await createCommissionFromSale({
      ...saleInput,
      externalPaymentId: `inv_${suffix}_2`,
      discountedAmount: 1000,
      originalAmount: 1000,
    })
    await matureCommission(secondSale.sale.commission!.id)
    wallet = await walletOf(affiliateId)
    // 44.10 (venda 1) + 300.00 (venda 2, 30% de 1000) = 344.10
    check('availableBalance acumulado após 2ª maturação', Number(wallet.availableBalance) === 344.1)

    // === 4) Saldo insuficiente — item #5/#13 da matriz =====================
    console.log('\n[4] Saldo insuficiente')
    await expectRejected('payout de R$99999 (> disponível) é rejeitado', () =>
      reservePayout({
        affiliateId,
        amount: 99999,
        pixKey: 'wallet-test@pix.local',
        idempotencyKey: `idem-insufficient-${suffix}`,
      }),
    )
    const payoutCountAfterReject = await prismaAdmin.affiliatePayout.count({ where: { affiliateId } })
    check('nenhum AffiliatePayout órfão criado na rejeição', payoutCountAfterReject === 0)
    wallet = await walletOf(affiliateId)
    check('availableBalance intacto após rejeição', Number(wallet.availableBalance) === 344.1)

    // === 5) Payout duplicado (mesma idempotencyKey) — item #11 =============
    console.log('\n[5] Payout duplicado (idempotencyKey)')
    const idemKey = `idem-payout-${suffix}`
    const p1 = await reservePayout({ affiliateId, amount: 100, pixKey: 'wallet-test@pix.local', idempotencyKey: idemKey })
    check('primeira solicitação de saque reserva o valor', p1.created)
    const p2 = await reservePayout({ affiliateId, amount: 100, pixKey: 'wallet-test@pix.local', idempotencyKey: idemKey })
    check('replay com a mesma idempotencyKey não cria novo payout', !p2.created && p2.payout.id === p1.payout.id)

    wallet = await walletOf(affiliateId)
    check('reservedBalance reflete só 1 reserva (não dobrou)', Number(wallet.reservedBalance) === 100)
    check('availableBalance debitado uma única vez', Number(wallet.availableBalance) === 244.1)

    // === 6) Duas solicitações concorrentes — item #12 ======================
    console.log('\n[6] Concorrência: 2 saques simultâneos de R$200 (saldo=244.10)')
    const [r1, r2] = await Promise.allSettled([
      reservePayout({ affiliateId, amount: 200, pixKey: 'wallet-test@pix.local', idempotencyKey: `idem-race-a-${suffix}` }),
      reservePayout({ affiliateId, amount: 200, pixKey: 'wallet-test@pix.local', idempotencyKey: `idem-race-b-${suffix}` }),
    ])
    const succeeded = [r1, r2].filter(r => r.status === 'fulfilled')
    const rejected = [r1, r2].filter(r => r.status === 'rejected')
    check('exatamente 1 das 2 solicitações concorrentes sucede', succeeded.length === 1)
    check('a outra é rejeitada por saldo insuficiente', rejected.length === 1 &&
      (rejected[0] as PromiseRejectedResult).reason instanceof InsufficientBalanceError)

    wallet = await walletOf(affiliateId)
    check(
      'saldo final consistente após a corrida (244.10 - 200 = 44.10 disponível, 300 reservado)',
      Number(wallet.availableBalance) === 44.1 && Number(wallet.reservedBalance) === 300,
    )

    // === 7) Ciclo completo de payout + replay pós-PAID — item #21 ==========
    console.log('\n[7] Ciclo completo do payout e replay pós-PAID')
    const approved = await approvePayout(p1.payout.id, 'test-admin')
    check('approve transiciona REQUESTED->APPROVED', approved?.status === 'APPROVED')

    const paid = await markPayoutPaid(p1.payout.id, 'test-admin')
    check('mark-paid transiciona APPROVED->PAID', paid?.status === 'PAID')

    wallet = await walletOf(affiliateId)
    check('lifetimePaid registrou a liquidação', Number(wallet.lifetimePaid) === 100)

    const replay = await reservePayout({ affiliateId, amount: 100, pixKey: 'wallet-test@pix.local', idempotencyKey: idemKey })
    check('replay do mesmo idempotencyKey após PAID devolve o payout já pago (sem nova reserva)', replay.payout.id === p1.payout.id && replay.payout.status === 'PAID')

    const doubleApprove = await approvePayout(p1.payout.id, 'test-admin')
    check('approve em payout já PAID é rejeitado (409/null — transição inválida)', doubleApprove === null)

    // === 8) Reversão idempotente ============================================
    console.log('\n[8] Reversão de comissão')
    const thirdSale = await createCommissionFromSale({
      ...saleInput,
      externalPaymentId: `inv_${suffix}_3`,
      discountedAmount: 100,
      originalAmount: 100,
    })
    const thirdCommissionId = thirdSale.sale.commission!.id
    const reverseKey = `reverse:STRIPE:re_${suffix}`
    const rev1 = await reverseCommission(thirdCommissionId, 'reembolso total do cliente', reverseKey)
    check('primeira reversão debita a comissão PENDING', rev1.reversed)

    const commissionAfterReverse = await prismaAdmin.affiliateCommission.findUniqueOrThrow({ where: { id: thirdCommissionId } })
    check('status da comissão vira REVERSED', commissionAfterReverse.status === 'REVERSED')

    const rev2 = await reverseCommission(thirdCommissionId, 'reembolso total do cliente', reverseKey)
    check('segunda reversão (já REVERSED) é no-op', !rev2.reversed)

    // === 9) Ajuste manual de admin ==========================================
    console.log('\n[9] Ajuste manual')
    const beforeAdjust = await walletOf(affiliateId)
    await adjustBalance({
      affiliateId,
      account: 'AVAILABLE',
      amount: 10,
      reason: 'teste automatizado — crédito de cortesia',
      adminId: 'test-admin',
    })
    const afterAdjust = await walletOf(affiliateId)
    check(
      'ajuste manual credita a conta indicada',
      Number(afterAdjust.availableBalance) === Number(beforeAdjust.availableBalance) + 10,
    )
    await expectRejected('ajuste sem reason é rejeitado', () =>
      adjustBalance({ affiliateId, account: 'AVAILABLE', amount: 1, reason: '', adminId: 'test-admin' }),
    )

    // === 10) Duas solicitações REALMENTE concorrentes com a MESMA
    // idempotencyKey — cobre o caminho P2002 dentro da mesma transação
    // (diferente do item 5, que é sequencial). Afiliado isolado para não
    // perturbar a aritmética de saldo dos testes anteriores.
    console.log('\n[10] Concorrência real com idempotencyKey idêntica (caminho P2002)')
    const race = await createAffiliateWithWallet({
      name: 'Wallet Race Test',
      email: `wallet-race-${suffix}@test.local`,
      code: `WALLETRACE${suffix}`,
      discountPercent: 10,
      commissionPercent: 30,
      pixKey: 'wallet-race@pix.local',
    })
    raceAffiliateId = race.id
    const raceSale = await createCommissionFromSale({
      affiliateId: race.id,
      processor: 'STRIPE',
      externalPaymentId: `inv_${suffix}_race`,
      type: 'INITIAL',
      plan: 'PRO',
      originalAmount: 1000,
      discountedAmount: 1000,
    })
    await matureCommission(raceSale.sale.commission!.id)

    const raceKey = `idem-race-same-key-${suffix}`
    const [rr1, rr2] = await Promise.all([
      reservePayout({ affiliateId: race.id, amount: 100, pixKey: 'wallet-race@pix.local', idempotencyKey: raceKey }),
      reservePayout({ affiliateId: race.id, amount: 100, pixKey: 'wallet-race@pix.local', idempotencyKey: raceKey }),
    ])
    check('as duas chamadas concorrentes com a mesma key devolvem o MESMO payout', rr1.payout.id === rr2.payout.id)
    check('só uma delas efetivamente criou (a outra é replay/P2002)', rr1.created !== rr2.created)

    const raceWallet = await walletOf(race.id)
    check('reservedBalance debitado uma única vez (não 200)', Number(raceWallet.reservedBalance) === 100)
    const racePayoutCount = await prismaAdmin.affiliatePayout.count({ where: { affiliateId: race.id } })
    check('exatamente 1 AffiliatePayout criado, não 2', racePayoutCount === 1)

    // === 11) Cancelamento/rejeição/falha de payout — cobre release_payout_reservation
    // de verdade (a corrida acima só exercita reserve_payout_amount/P2002,
    // nunca a liberação). Reaproveita a carteira do afiliado de corrida:
    // disponível=200, reservado=100 nesse ponto.
    console.log('\n[11] Cancelamento/rejeição/falha (release_payout_reservation)')
    const raceWinner = rr1.created ? rr1.payout : rr2.payout
    const cancelled = await cancelPayout(raceWinner.id, race.id)
    check('cancelPayout transiciona REQUESTED->CANCELLED', cancelled?.status === 'CANCELLED')

    let raceWalletAfter = await walletOf(race.id)
    check('reservedBalance volta a 0 após cancelamento', Number(raceWalletAfter.reservedBalance) === 0)
    check('availableBalance volta ao valor pré-reserva (300)', Number(raceWalletAfter.availableBalance) === 300)

    const cancelReplay = await cancelPayout(raceWinner.id, race.id)
    check('cancelar de novo o mesmo payout (já CANCELLED) é rejeitado (null)', cancelReplay === null)

    const toReject = await reservePayout({ affiliateId: race.id, amount: 100, pixKey: 'wallet-race@pix.local', idempotencyKey: `idem-reject-${suffix}` })
    const rejectedPayout = await rejectPayout(toReject.payout.id, 'test-admin', 'suspeita de fraude')
    check('rejectPayout transiciona REQUESTED->REJECTED', rejectedPayout?.status === 'REJECTED')
    raceWalletAfter = await walletOf(race.id)
    check('reservedBalance liberado após rejeição', Number(raceWalletAfter.reservedBalance) === 0)

    const toFail = await reservePayout({ affiliateId: race.id, amount: 100, pixKey: 'wallet-race@pix.local', idempotencyKey: `idem-fail-${suffix}` })
    const approvedForFail = await approvePayout(toFail.payout.id, 'test-admin')
    check('approvePayout transiciona REQUESTED->APPROVED (para depois falhar)', approvedForFail?.status === 'APPROVED')
    const failed = await markPayoutFailed(toFail.payout.id, 'test-admin', 'Pix não confirmado pelo banco')
    check('markPayoutFailed transiciona APPROVED->FAILED', failed?.status === 'FAILED')
    raceWalletAfter = await walletOf(race.id)
    check('reservedBalance liberado após falha; availableBalance volta a 300', Number(raceWalletAfter.reservedBalance) === 0 && Number(raceWalletAfter.availableBalance) === 300)
  } finally {
    // --- limpeza via bypass (ordem respeita as FKs Restrict) ---
    await prismaAdmin.affiliateLedgerEntry.deleteMany({ where: { affiliateId } })
    await prismaAdmin.affiliatePayout.deleteMany({ where: { affiliateId } })
    await prismaAdmin.affiliateCommission.deleteMany({ where: { affiliateId } })
    await prismaAdmin.affiliateSale.deleteMany({ where: { affiliateId } })
    await prismaAdmin.affiliateWallet.deleteMany({ where: { affiliateId } })
    if (raceAffiliateId) {
      await prismaAdmin.affiliateLedgerEntry.deleteMany({ where: { affiliateId: raceAffiliateId } })
      await prismaAdmin.affiliatePayout.deleteMany({ where: { affiliateId: raceAffiliateId } })
      await prismaAdmin.affiliateCommission.deleteMany({ where: { affiliateId: raceAffiliateId } })
      await prismaAdmin.affiliateSale.deleteMany({ where: { affiliateId: raceAffiliateId } })
      await prismaAdmin.affiliateWallet.deleteMany({ where: { affiliateId: raceAffiliateId } })
      await prismaAdmin.affiliate.deleteMany({ where: { id: raceAffiliateId } })
    }
    await prismaAdmin.affiliate.deleteMany({ where: { id: affiliateId } })
    await prismaAdmin.$disconnect()
  }

  console.log(`\n=== Carteira de afiliados: ${passed} passou, ${failed} falhou ===`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Erro fatal nos testes da carteira de afiliados:', e)
  process.exit(1)
})
