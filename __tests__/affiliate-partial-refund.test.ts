/**
 * Testes de reembolso parcial (Decisão B — Fase 4).
 * Cobre reversão proporcional da comissão.
 *
 * Roda com: `npx tsx __tests__/affiliate-partial-refund.test.ts`
 */
import { prismaAdmin } from '../lib/prisma'
import { createAffiliateWithWallet, createCommissionFromSale, reverseCommissionPartially } from '../lib/affiliate-ledger'

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

async function walletOf(affiliateId: string) {
  return prismaAdmin.affiliateWallet.findUniqueOrThrow({ where: { affiliateId } })
}

async function main() {
  const now = Date.now()
  const testUserEmail = `test-refund-${now}@test.local`

  // Criar usuário de teste
  const testUser = await prismaAdmin.user.create({
    data: {
      email: testUserEmail,
      plan: 'FREE',
    },
  })

  // Criar afiliado de teste
  const { id: affiliateId } = await createAffiliateWithWallet({
    name: 'Partial Refund Test',
    email: `aff-refund-${now}@test.local`,
    code: `REFUND${now.toString().slice(-6)}`,
    discountPercent: 0,
    commissionPercent: 30,
  })

  try {
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[1] Reembolso parcial 25% de uma comissão')

    // Cobrança original: R$100 (10000 centavos) → comissão 30% = R$30
    const chargeId1 = `ch_partial_25_${now}`
    const sale1 = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'STRIPE',
      externalPaymentId: chargeId1,
      type: 'INITIAL',
      plan: 'PRO',
      originalAmount: 100,
      discountedAmount: 100,
    })

    const originalCommission = Number(sale1.sale.commission!.amount)
    check('comissão original = 30', Math.abs(originalCommission - 30) < 0.01)

    let wallet = await walletOf(affiliateId)
    check('saldo PENDING = 30', Math.abs(Number(wallet.pendingBalance) - 30) < 0.01)

    // Reembolso de 25% (R$25 de R$100)
    const refundResult25 = await reverseCommissionPartially({
      commissionId: sale1.sale.commission!.id,
      originalChargeAmount: 10000, // R$100 em centavos
      refundedAmount: 2500, // R$25 em centavos (25%)
      refundId: `ref_25_${now}`,
      reason: 'Partial refund 25%',
    })

    check('reembolso parcial 25% executado', refundResult25.reversedPartially)
    check('proporção calculada = 0.25', parseFloat(refundResult25.proportion) === 0.25)
    // Esperado reverter: 30 * 0.25 = 7.5
    check('valor revertido = 7.50', Math.abs(Number(refundResult25.amountReversed) - 7.5) < 0.01)

    wallet = await walletOf(affiliateId)
    check('saldo PENDING após refund 25% = 22.50', Math.abs(Number(wallet.pendingBalance) - 22.5) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[2] Múltiplos reembolsos parciais (25% + 50% = 75%)')

    // Reembolso de 50% adicional (mais R$50, total R$75 reembolsado)
    const refundResult50 = await reverseCommissionPartially({
      commissionId: sale1.sale.commission!.id,
      originalChargeAmount: 10000,
      refundedAmount: 5000, // R$50 em centavos (50% do original)
      refundId: `ref_50_${now}`,
      reason: 'Partial refund 50%',
    })

    check('segundo reembolso 50% executado', refundResult50.reversedPartially)
    // Esperado reverter: 30 * 0.50 = 15
    check('valor revertido no segundo = 15.00', Math.abs(Number(refundResult50.amountReversed) - 15) < 0.01)

    wallet = await walletOf(affiliateId)
    // 22.50 (após 25%) - 15 (após 50%) = 7.50
    check('saldo PENDING após reembolsos 25%+50% = 7.50', Math.abs(Number(wallet.pendingBalance) - 7.5) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[3] Reembolso de 100% não deve ultrapassar comissão')

    // Tentar reembolsar os 25% restantes
    const refundResult25last = await reverseCommissionPartially({
      commissionId: sale1.sale.commission!.id,
      originalChargeAmount: 10000,
      refundedAmount: 2500, // R$25 (último 25%)
      refundId: `ref_25_last_${now}`,
      reason: 'Partial refund 25% final',
    })

    check('último reembolso 25% executado', refundResult25last.reversedPartially)
    // Esperado reverter: 30 * 0.25 = 7.50
    check('valor revertido no terceiro = 7.50', Math.abs(Number(refundResult25last.amountReversed) - 7.5) < 0.01)

    wallet = await walletOf(affiliateId)
    // Saldo deve ser 0 (7.50 - 7.50)
    check('saldo PENDING após reembolsos 100% = 0', Math.abs(Number(wallet.pendingBalance)) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[4] Tentativa de refund acima do valor original deve falhar')

    const refundResultOver = await prismaAdmin.$transaction(async (tx) => {
      try {
        return await reverseCommissionPartially({
          commissionId: sale1.sale.commission!.id,
          originalChargeAmount: 10000,
          refundedAmount: 15000, // R$150 (acima de R$100)
          refundId: `ref_over_${now}`,
          reason: 'Invalid refund',
        })
      } catch (e: any) {
        return { error: e.message }
      }
    })

    check('tentativa de refund acima do valor original falha', !!refundResultOver.error)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[5] Idempotência — mesmo refundId não duplica')

    // Nova venda para testar idempotência sem estar zerada
    const chargeId2 = `ch_partial_idem_${now}`
    const sale2 = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'STRIPE',
      externalPaymentId: chargeId2,
      type: 'INITIAL',
      plan: 'START',
      originalAmount: 97,
      discountedAmount: 97,
    })

    const originalCommission2 = Number(sale2.sale.commission!.amount)

    // Primeiro reembolso
    const idemRef1 = await reverseCommissionPartially({
      commissionId: sale2.sale.commission!.id,
      originalChargeAmount: 9700, // R$97 em centavos
      refundedAmount: 4850, // R$48.50 (50%)
      refundId: `ref_idem_${now}`,
      reason: 'Refund for idempotency test',
    })

    check('primeiro reembolso idempotência executado', idemRef1.reversedPartially)

    // Mesmo refundId, replay deve retornar que não foi criado novamente
    const idemRef2 = await reverseCommissionPartially({
      commissionId: sale2.sale.commission!.id,
      originalChargeAmount: 9700,
      refundedAmount: 4850, // Mesmo valor
      refundId: `ref_idem_${now}`, // Mesmo ID
      reason: 'Replay of same refund',
    })

    check('replay do mesmo refundId é idempotente (não cria novamente)', !idemRef2.reversedPartially)
    check('valor revertido no replay é o mesmo', idemRef2.existingAmount?.eq(idemRef1.amountReversed) ?? false)

    // Verificar saldo — só deve ter uma reversão
    wallet = await walletOf(affiliateId)
    const expectedBalance = originalCommission2 / 2 // 50% revertido uma vez
    check(
      `saldo reflete única reversão (não duplicada): ${Number(wallet.pendingBalance).toFixed(2)}`,
      Math.abs(Number(wallet.pendingBalance) - expectedBalance) < 0.01,
    )

    // ──────────────────────────────────────────────────────────────────────────
    // Limpeza
    console.log('\n[Cleanup]')
    try {
      await prismaAdmin.user.delete({ where: { id: testUser.id } })
      await prismaAdmin.affiliate.delete({ where: { id: affiliateId } })
      console.log('Dados de teste removidos')
    } catch (err) {
      console.log('Dados de teste deixados no banco para inspeção manual')
    }
  } catch (error) {
    console.error('Erro fatal em teste:', error)
    process.exit(1)
  }

  // Relatório
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testes: ${passed} ✓ | ${failed} ✗`)
  console.log(`${'='.repeat(60)}`)

  process.exit(failed > 0 ? 1 : 0)
}

main()
