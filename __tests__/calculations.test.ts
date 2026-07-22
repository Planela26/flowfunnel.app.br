/**
 * Auditoria de cálculos — testes unitários de funções PURAS (sem DB/rede).
 * Cobre: planos/limites/features, trial, lead scoring, mapeamento de estágios
 * de webhook, eventos de venda (dedup/amount) e política de senha.
 * Roda com: npx tsx __tests__/calculations.test.ts
 */
import {
  normalizePlan, getPlanLimit, getPlanPriceBRL, canAccessFeature,
  getMaxFunnels, getMaxWhatsappNumbers, getHistoryLimitDays, isUnlimited,
} from '../lib/plans'
import {
  isTrialActive, isTrialExpired, trialDaysLeft, getEffectivePlan,
} from '../lib/trial'
import { scoreLead } from '../lib/leadScoring'
import { mapPlatformStatusToStage } from '../lib/webhook-stages'
import {
  isSaleEvent, isCheckoutEvent, isCanceledSale, extractAmount, saleTransactionId,
} from '../lib/sale-events'
import { validatePasswordStrength } from '../lib/password'

let pass = 0, fail = 0
const failures: string[] = []
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; failures.push(name); console.error('  ✗', name) }
}
function eq(name: string, a: unknown, b: unknown) {
  ok(`${name} (=${String(b)}, got ${String(a)})`, a === b)
}

const DAY = 86400000

console.log('\n[Planos / limites / features]')
eq('normalizePlan inválido → FREE', normalizePlan('xpto'), 'FREE')
eq('normalizePlan minúsculo pro → PRO', normalizePlan('pro'), 'PRO')
eq('limite START = 1000', getPlanLimit('START'), 1000)
eq('limite PRO = 3000', getPlanLimit('PRO'), 3000)
eq('limite SCALE = -1 (ilimitado)', getPlanLimit('SCALE'), -1)
eq('limite FREE = 0', getPlanLimit('FREE'), 0)
ok('SCALE é ilimitado', isUnlimited('SCALE') === true)
eq('preço START = 97', getPlanPriceBRL('START'), 97)
eq('preço PRO = 147', getPlanPriceBRL('PRO'), 147)
eq('preço SCALE = 297', getPlanPriceBRL('SCALE'), 297)
eq('funis START = 1', getMaxFunnels('START'), 1)
eq('funis PRO = 3', getMaxFunnels('PRO'), 3)
eq('whatsapp PRO = 3', getMaxWhatsappNumbers('PRO'), 3)
eq('histórico START = 7 dias', getHistoryLimitDays('START'), 7)
eq('histórico PRO = 365 dias', getHistoryLimitDays('PRO'), 365)
ok('FREE não acessa lead_scoring', canAccessFeature('FREE', 'lead_scoring') === false)
ok('START acessa lead_scoring', canAccessFeature('START', 'lead_scoring') === true)
ok('START NÃO acessa full_history (PRO+)', canAccessFeature('START', 'full_history') === false)
ok('PRO acessa full_history', canAccessFeature('PRO', 'full_history') === true)
ok('PRO NÃO acessa automatic_alerts (SCALE)', canAccessFeature('PRO', 'automatic_alerts') === false)
ok('SCALE acessa automatic_alerts', canAccessFeature('SCALE', 'automatic_alerts') === true)
ok('SCALE acessa trend_analysis', canAccessFeature('SCALE', 'trend_analysis') === true)

console.log('\n[Trial]')
const future = new Date(Date.now() + 3 * DAY)
const past = new Date(Date.now() - 1 * DAY)
ok('trial status=active futuro → ativo', isTrialActive({ plan: 'FREE', trialStatus: 'active', trialEndsAt: future, trialPlan: 'PRO' }))
ok('trial status=active passado → inativo', !isTrialActive({ plan: 'FREE', trialStatus: 'active', trialEndsAt: past, trialPlan: 'PRO' }))
ok('trial status=active passado → expirado', isTrialExpired({ plan: 'FREE', trialStatus: 'active', trialEndsAt: past, trialPlan: 'PRO' }))
ok('trial legado (none + trialPlan + FREE) futuro → ativo', isTrialActive({ plan: 'FREE', trialStatus: 'none', trialEndsAt: future, trialPlan: 'START' }))
ok('trial não ativa se plano já pago', !isTrialActive({ plan: 'PRO', trialStatus: 'none', trialEndsAt: future, trialPlan: 'PRO' }))
eq('trialDaysLeft ~3 dias', trialDaysLeft(new Date(Date.now() + 3 * DAY - 1000)), 3)
eq('trialDaysLeft passado → 0', trialDaysLeft(past), 0)
eq('getEffectivePlan trial ativo → trialPlan', getEffectivePlan({ plan: 'FREE', trialStatus: 'active', trialEndsAt: future, trialPlan: 'SCALE' }), 'SCALE')
eq('getEffectivePlan sem trial → plano real', getEffectivePlan({ plan: 'START', trialStatus: 'none' }), 'START')
eq('getEffectivePlan trial expirado → FREE real', getEffectivePlan({ plan: 'FREE', trialStatus: 'expired', trialEndsAt: past, trialPlan: 'PRO' }), 'FREE')

console.log('\n[Lead scoring]')
const buyer = scoreLead({ phone: '5511999', platform: 'HOTMART', events: [
  { type: 'click', timestamp: new Date(Date.now() - 2 * DAY) },
  { type: 'message', timestamp: new Date(Date.now() - DAY) },
  { type: 'checkout', timestamp: new Date(Date.now() - 3600_000) },
  { type: 'sale', amount: 297, timestamp: new Date(Date.now() - 1800_000) },
]})
ok('comprador → quente', buyer.classification === 'quente')
ok('comprador score alto (>=71)', buyer.score >= 71)
eq('comprador totalSpent = 297', buyer.totalSpent, 297)
ok('comprador sinal "Já comprou"', buyer.signals.includes('Já comprou'))
const cold = scoreLead({ phone: '5511888', events: [
  { type: 'click', timestamp: new Date(Date.now() - 40 * DAY) },
]})
ok('1 clique antigo → frio', cold.classification === 'frio')
ok('score sempre 0..100', buyer.score <= 100 && cold.score >= 0)

console.log('\n[Mapeamento de estágios de webhook]')
ok('paid → Pago/isPaid', (() => { const r = mapPlatformStatusToStage('paid'); return r.stage === 'Pago' && r.isPaid })())
ok('approved → Pago', mapPlatformStatusToStage('approved').stage === 'Pago')
ok('refused → Recusado/isLost', (() => { const r = mapPlatformStatusToStage('refused'); return r.stage === 'Recusado' && r.isLost })())
ok('refunded → Reembolsado', mapPlatformStatusToStage('refunded').stage === 'Reembolsado')
ok('chargeback → Chargeback', mapPlatformStatusToStage('chargeback').stage === 'Chargeback')
ok('abandoned → Abandonado', mapPlatformStatusToStage('abandoned').stage === 'Abandonado')
ok('checkout_started → Checkout', mapPlatformStatusToStage('checkout_started').stage === 'Checkout')
ok('vazio → stage null', mapPlatformStatusToStage('').stage === null)
ok('desconhecido → stage null + suffix sanitizado', (() => { const r = mapPlatformStatusToStage('weird$status'); return r.stage === null && /^[a-z0-9_]+$/.test(r.eventSuffix) })())

console.log('\n[Eventos de venda — dedup / amount]')
ok('isSaleEvent purchase_complete', isSaleEvent('hotmart_purchase_complete'))
ok('isSaleEvent nega checkout', !isSaleEvent('kiwify_checkout_started'))
ok('isCheckoutEvent', isCheckoutEvent('kiwify_checkout_started'))
ok('isCanceledSale refunded', isCanceledSale({ status: 'refunded' }))
ok('isCanceledSale chargeback', isCanceledSale({ status: 'chargeback' }))
ok('isCanceledSale aprovado → false', !isCanceledSale({ status: 'approved' }))
eq('extractAmount número', extractAmount({ amount: 197.5 }), 197.5)
eq('extractAmount string', extractAmount({ price: '97.00' }), 97)
eq('extractAmount inválido → 0', extractAmount({ amount: 'abc' }), 0)
eq('saleTransactionId transaction_id', saleTransactionId({ transaction_id: 'TX1' }), 'TX1')
eq('saleTransactionId ausente → null', saleTransactionId({}), null)

console.log('\n[Política de senha]')
ok('senha curta rejeitada', !validatePasswordStrength('Ab1').ok)
ok('senha sem número rejeitada', !validatePasswordStrength('abcdefgh').ok)
ok('senha sem letra rejeitada', !validatePasswordStrength('12345678').ok)
ok('senha válida aceita', validatePasswordStrength('Senha123').ok)
ok('senha >128 rejeitada', !validatePasswordStrength('a1'.repeat(70)).ok)

console.log(`\n=== CÁLCULOS: ${pass} passou, ${fail} falhou ===`)
if (fail) { console.error('FALHAS:', failures.join(' | ')); process.exit(1) }
