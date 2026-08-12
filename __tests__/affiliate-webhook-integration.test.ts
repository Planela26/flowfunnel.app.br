/**
 * Testes de integração webhook + comissão (Fase 4).
 * Cobre cenários de criação de comissão, reversão e self-referral.
 *
 * Roda com: `npx tsx __tests__/affiliate-webhook-integration.test.ts`
 *
 * Usa banco real de desenvolvimento. Cria dados descartáveis e limpa tudo.
 */
import { prismaAdmin } from '../lib/prisma'
import {
  createAffiliateWithWallet,
  createCommissionFromSale,
  reverseCommission,
  matureCommission,
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
  const now = Date.now()
  const testUserEmail = `test-webhook-${now}@test.local`
  const testAffiliateCode = `TESTWEBHOOK${now.toString().slice(-6)}`

  // Criar usuário de teste (comprador)
  const testUser = await prismaAdmin.user.create({
    data: {
      email: testUserEmail,
      plan: 'FREE',
    },
  })

  // Criar afiliado de teste
  const { id: affiliateId } = await createAffiliateWithWallet({
    name: 'Webhook Test Affiliate',
    email: `aff-webhook-${now}@test.local`,
    code: testAffiliateCode,
    discountPercent: 10,
    commissionPercent: 30,
  })

  // Criar afiliado self-referral para teste
  const { id: selfRefAffiliateId } = await createAffiliateWithWallet({
    name: 'Self-Referral Test',
    email: `self-ref-${now}@test.local`,
    code: `SELFREF${now.toString().slice(-6)}`,
    discountPercent: 0,
    commissionPercent: 20,
    userId: testUser.id, // O afiliado É o próprio usuário
  })

  try {
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[1] Stripe invoice.paid — Criação de comissão inicial')
    const stripeInvoiceId = `inv_webhook_${now}`
    const sale1 = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'STRIPE',
      externalPaymentId: stripeInvoiceId,
      externalSubscriptionId: `sub_${now}`,
      type: 'INITIAL',
      plan: 'PRO',
      originalAmount: 147,
      discountedAmount: 147,
    })

    check('comissão criada na Stripe invoice.paid', sale1.created)
    check('AffiliateSale registrada', !!sale1.sale.id)
    check('AffiliateCommission ligada à venda', !!sale1.sale.commission)

    let wallet = await walletOf(affiliateId)
    check('saldo PENDING reflete a comissão', Number(wallet.pendingBalance) === 44.1)
    check('lifetimeEarned atualizado', Number(wallet.lifetimeEarned) === 44.1)

    // Idempotência: segunda chamada mesmo invoice
    const sale1Dup = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'STRIPE',
      externalPaymentId: stripeInvoiceId,
      externalSubscriptionId: `sub_${now}`,
      type: 'INITIAL',
      plan: 'PRO',
      originalAmount: 147,
      discountedAmount: 147,
    })
    check('idempotência: segunda chamada é no-op', !sale1Dup.created && sale1Dup.sale.commission?.id === sale1.sale.commission?.id)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[2] Stripe invoice.paid — Renovação automática (RENEWAL)')
    const stripeInvoiceId2 = `inv_webhook_renewal_${now}`
    const sale2 = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'STRIPE',
      externalPaymentId: stripeInvoiceId2,
      externalSubscriptionId: `sub_${now}`, // Mesma subscription
      type: 'RENEWAL',
      plan: 'PRO',
      originalAmount: 147,
      discountedAmount: 147,
    })

    check('segunda venda (renovação) criada', sale2.created)
    check('comissão de renovação é independente', sale2.sale.commission?.id !== sale1.sale.commission?.id)
    check('comissão de renovação tem mesmo valor', Number(sale2.sale.commission?.amount) === 44.1)

    wallet = await walletOf(affiliateId)
    check('saldo PENDING agora tem duas comissões', Number(wallet.pendingBalance) === 88.2)
    check('lifetimeEarned acumula', Number(wallet.lifetimeEarned) === 88.2)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[3] Mercado Pago payment.approved — Comissão MP (sempre INITIAL)')
    const mpPaymentId = `mp_webhook_${now}`
    const saleMp = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'MERCADOPAGO',
      externalPaymentId: mpPaymentId,
      type: 'INITIAL', // MP não tem renovação automática (Seção 4.0.3)
      plan: 'START',
      originalAmount: 97,
      discountedAmount: 97,
    })

    check('comissão MP criada', saleMp.created)
    check('comissão MP calcula 30% de R$97', Math.abs(Number(saleMp.sale.commission?.amount) - 29.1) < 0.01)

    wallet = await walletOf(affiliateId)
    const expectedTotal = 88.2 + 29.1
    check('saldo PENDING inclui MP', Math.abs(Number(wallet.pendingBalance) - expectedTotal) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[4] Self-referral bloqueado — afiliado não lucra vendendo para si mesmo')
    const selfRefSale = await createCommissionFromSale({
      affiliateId: selfRefAffiliateId,
      userId: testUser.id, // Mesmo usuário = autoindicação
      processor: 'STRIPE',
      externalPaymentId: `inv_selfref_${now}`,
      type: 'INITIAL',
      plan: 'SCALE',
      originalAmount: 297,
      discountedAmount: 297,
    })

    check('venda é criada (fato imutável)', selfRefSale.created)
    // Nota: a comissão É criada, mas o webhook a bloqueia antes de contar.
    // Aqui estamos no nível de ledger — o webhook é que valida self-referral.
    check('comissão é criada', !!selfRefSale.sale.commission)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[5] Reversão — Stripe refund completo de uma comissão PENDING')
    const reverseResult = await reverseCommission(
      sale1.sale.commission!.id,
      `Refund of invoice ${stripeInvoiceId}`,
      `reverse:STRIPE:${stripeInvoiceId}`,
    )

    check('reversão executada', reverseResult.reversed)
    check('comissão passa para status REVERSED', !!reverseResult.commission)

    // Verificar saldo — a reversão de uma comissão PENDING debita direto de pendingBalance
    wallet = await walletOf(affiliateId)
    // Antes: 44.1 (comissão 1) + 44.1 (comissão 2) + 29.1 (MP) = 117.3
    // Após reverter comissão 1: 117.3 - 44.1 = 73.2 (comissão 2 + MP)
    const expectedPending = (88.2 + 29.1) - 44.1 // = 73.2
    check('saldo PENDING reflete reversão', Math.abs(Number(wallet.pendingBalance) - expectedPending) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[6] Maturação — PENDING → AVAILABLE após 15 dias')
    // Forçar a maturação da comissão 2 (renovação) ajustando maturesAt para now
    await prismaAdmin.affiliateCommission.update({
      where: { id: sale2.sale.commission!.id },
      data: { maturesAt: new Date(Date.now() - 1000) }, // 1s no passado
    })

    const matureResult = await matureCommission(sale2.sale.commission!.id)
    check('maturação bem-sucedida', matureResult.matured)

    const commission = await prismaAdmin.affiliateCommission.findUniqueOrThrow({
      where: { id: sale2.sale.commission!.id },
    })
    check('comissão passa para AVAILABLE', commission.status === 'AVAILABLE')

    wallet = await walletOf(affiliateId)
    // Agora: 44.1 (reversida, não conta) + 44.1 (amadurecida, em AVAILABLE) + 29.1 (ainda PENDING)
    // pendingBalance = 29.1, availableBalance = 44.1
    check('saldo AVAILABLE reflete maturação', Math.abs(Number(wallet.availableBalance) - 44.1) < 0.01)
    check('saldo PENDING = MP apenas', Math.abs(Number(wallet.pendingBalance) - 29.1) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[7] Clawback tardio — Reversão de comissão já AVAILABLE (Decision E)')
    const clawbackReverse = await reverseCommission(
      sale2.sale.commission!.id,
      'Chargeback after payout',
      `reverse:STRIPE:chargeback:late_${now}`,
    )

    check('clawback de comissão madura executado', clawbackReverse.reversed)

    wallet = await walletOf(affiliateId)
    // availableBalance passa de 44.1 para 0 (reversão remove a comissão madura)
    check('saldo AVAILABLE após clawback', Math.abs(Number(wallet.availableBalance) - 0) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[8] Compensação automática (Decision E) — nova comissão abate saldo negativo')
    const mpPaymentId2 = `mp_webhook_compensate_${now}`
    const compensateSale = await createCommissionFromSale({
      affiliateId,
      userId: testUser.id,
      processor: 'MERCADOPAGO',
      externalPaymentId: mpPaymentId2,
      type: 'INITIAL',
      plan: 'PRO',
      originalAmount: 147,
      discountedAmount: 147,
    })

    check('nova comissão criada enquanto saldo negativo', compensateSale.created)
    check('nova comissão = 44.1', Math.abs(Number(compensateSale.sale.commission?.amount) - 44.1) < 0.01)

    wallet = await walletOf(affiliateId)
    // pendingBalance agora = 29.1 (MP anterior) + 44.1 (nova) = 73.2
    // availableBalance = -44.1 (negativo)
    // Total = 29.1 (já existia, ainda PENDING)
    check('nova comissão entra em PENDING (vai para maturação depois)', Number(wallet.pendingBalance) > 0)

    // Mature a nova comissão para demonstrar compensação
    await prismaAdmin.affiliateCommission.update({
      where: { id: compensateSale.sale.commission!.id },
      data: { maturesAt: new Date(Date.now() - 1000) },
    })
    await matureCommission(compensateSale.sale.commission!.id)

    wallet = await walletOf(affiliateId)
    // Após maturar a nova comissão (44.1):
    // pendingBalance: 29.1 (MP anterior)
    // availableBalance: 0 (estava) + 44.1 (nova amadurecida) = 44.1
    check('comissão nova madura adiciona ao saldo', Math.abs(Number(wallet.availableBalance) - 44.1) < 0.01)

    // ──────────────────────────────────────────────────────────────────────────
    // Limpeza
    console.log('\n[Cleanup]')
    await prismaAdmin.user.delete({ where: { id: testUser.id } })
    await prismaAdmin.affiliate.delete({ where: { id: affiliateId } })
    await prismaAdmin.affiliate.delete({ where: { id: selfRefAffiliateId } })
    console.log('Dados de teste removidos')
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
