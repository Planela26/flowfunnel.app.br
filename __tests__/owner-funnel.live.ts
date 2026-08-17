/**
 * Cadeia completa do funil próprio: anúncio → LP → CTA → checkout → PIX → compra.
 *
 * Roda com: npx tsx __tests__/owner-funnel.live.ts
 * Exige o dev server em :5000 e o banco de TESTE.
 *
 * Cobre também os casos que costumam passar despercebidos: abandono na LP,
 * abandono no checkout, PIX gerado e não pago, webhook duplicado e sessão
 * retomada depois.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { registrarEventoProprio, registrarCompraDoFunilProprio, EVENTOS } from '../lib/owner-funnel'

const p = new PrismaClient()
const BASE = 'http://localhost:5000'
const EMAIL_OWNER = 'owner-lab@test.local'

let ok = 0, bad = 0
function checa(n: string, c: boolean, d?: string) {
  if (c) { ok++; console.log('  PASS  ' + n) }
  else { bad++; console.log('  FALHA ' + n + (d ? '\n        ' + d : '')) }
}
const secao = (t: string) => console.log(`\n── ${t}`)

const evento = (corpo: any) =>
  fetch(`${BASE}/api/track/self`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })

async function main() {
  await p.user.deleteMany({ where: { email: EMAIL_OWNER } })
  const owner = await p.user.create({
    data: {
      email: EMAIL_OWNER, name: 'Owner Lab', role: 'ADMIN',
      emailVerified: new Date(), createdAt: new Date('2019-01-01'),
    },
  })
  // Fixa a conta do laboratório para o teste não depender de qual ADMIN é o
  // mais antigo no banco compartilhado.
  process.env.OWNER_TRACKING_USER_ID = owner.id

  const lead = 'l_jornada_' + Date.now()
  const base = {
    lead_id: lead, visitor_id: 'v_jornada', session_id: 's_jornada',
    url: 'https://flowsara.com.br/',
    utm: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'FlowSara - Conversão', utm_content: 'Criativo LP 03' },
    click_ids: { fbclid: 'FB_ABC123' },
    creative: { campaign_id: '120111', adset_id: '120222', ad_id: '120333' },
  }

  secao('1. Clique no anúncio → Landing Page')
  {
    const r = await evento({ ...base, event: 'page_view' })
    checa('page_view aceito', r.status === 200, `veio ${r.status}`)
    const l = await p.trackedLead.findFirst({ where: { userId: owner.id, leadId: lead } })
    checa('visitante criado sob a conta Owner', !!l)
    checa('origem preservada', l?.utmSource === 'facebook' && l?.utmCampaign === 'FlowSara - Conversão', `utm=${l?.utmSource}`)
    checa('fbclid preservado', l?.fbclid === 'FB_ABC123', `fbclid=${l?.fbclid}`)
    checa('criativo identificado', l?.campaignId === '120111' && l?.adsetId === '120222' && l?.adId === '120333',
      `${l?.campaignId}/${l?.adsetId}/${l?.adId}`)
    const s = await p.trackedSession.findFirst({ where: { userId: owner.id, sessionId: 's_jornada' } })
    checa('sessão registrada', !!s)
  }

  secao('2. Comportamento na página')
  {
    for (const e of ['scroll_25', 'scroll_50', 'scroll_60', 'scroll_75', 'scroll_90']) await evento({ ...base, event: e })
    await evento({ ...base, event: 'cta_click', meta: { href: '/checkout?plan=START' } })
    const nomes = (await p.trackedEvent.findMany({ where: { userId: owner.id, leadId: lead }, select: { eventName: true } })).map(e => e.eventName)
    checa('degraus de scroll gravados', ['scroll_25', 'scroll_50', 'scroll_75', 'scroll_90'].every(e => nomes.includes(e)), nomes.join(','))
    checa('cta_click gravado', nomes.includes('cta_click'))
  }

  secao('3. O navegador não forja compra')
  {
    const r = await evento({ ...base, event: 'payment_approved' })
    checa('payment_approved recusado com 400', r.status === 400, `veio ${r.status}`)
    const n = await p.trackedEvent.count({ where: { userId: owner.id, leadId: lead, eventName: 'payment_approved' } })
    checa('e nada foi gravado', n === 0, `gravados=${n}`)
  }

  secao('4. Checkout → PIX gerado (ainda NÃO é venda)')
  {
    await registrarEventoProprio({ leadId: lead, evento: EVENTOS.checkoutInitiated, metadata: { plano: 'START' } })
    await registrarEventoProprio({ leadId: lead, evento: EVENTOS.pixGenerated, metadata: { paymentId: 'MP-1', valor: 47.9 } })
    const nomes = (await p.trackedEvent.findMany({ where: { userId: owner.id, leadId: lead }, select: { eventName: true } })).map(e => e.eventName)
    checa('checkout_initiated e pix_generated gravados', nomes.includes('checkout_initiated') && nomes.includes('pix_generated'))
    const vendas = await p.trackedConversion.count({ where: { userId: owner.id, leadId: lead } })
    checa('PIX gerado NÃO conta como venda', vendas === 0, `conversoes=${vendas}`)
  }

  secao('5. PIX pago → compra e atribuição fechada')
  {
    await registrarCompraDoFunilProprio({ leadId: lead, paymentId: 'MP-1', plano: 'START', valor: 47.9, metodo: 'pix' })
    const conv = await p.trackedConversion.findFirst({ where: { userId: owner.id, orderId: 'MP-1' } })
    checa('compra registrada', !!conv && conv.value === 47.9, `valor=${conv?.value}`)
    const attr = await p.saleAttribution.findFirst({ where: { userId: owner.id, transactionId: 'MP-1' } })
    checa('atribuição criada', !!attr)
    checa('determinística com confiança 1', attr?.method === 'deterministic' && Number(attr?.confidence) === 1, `${attr?.method}/${attr?.confidence}`)
    checa('ligada ao lead da jornada', attr?.leadId === lead, `leadId=${attr?.leadId}`)
    checa('origem congelada no momento da compra', attr?.utmCampaign === 'FlowSara - Conversão', `campanha=${attr?.utmCampaign}`)
    const meta = attr?.metadata ? JSON.parse(attr.metadata) : {}
    checa('criativo preservado na atribuição', meta.adId === '120333', `adId=${meta.adId}`)
  }

  secao('6. Webhook duplicado não duplica receita')
  {
    await registrarCompraDoFunilProprio({ leadId: lead, paymentId: 'MP-1', plano: 'START', valor: 47.9, metodo: 'pix' })
    const n = await p.trackedConversion.count({ where: { userId: owner.id, orderId: 'MP-1' } })
    checa('continua com UMA conversão', n === 1, `conversoes=${n}`)
    const soma = await p.trackedConversion.aggregate({ where: { userId: owner.id }, _sum: { value: true } })
    checa('receita não dobrou', soma._sum.value === 47.9, `receita=${soma._sum.value}`)
  }

  secao('7. Abandonos permanecem abandonos')
  {
    const soLP = 'l_abandono_lp_' + Date.now()
    await evento({ ...base, lead_id: soLP, session_id: 's_ab1', event: 'page_view' })
    const evLP = await p.trackedEvent.count({ where: { userId: owner.id, leadId: soLP } })
    checa('abandono na LP: só page_view', evLP === 1, `eventos=${evLP}`)

    const soCheckout = 'l_abandono_ck_' + Date.now()
    await evento({ ...base, lead_id: soCheckout, session_id: 's_ab2', event: 'page_view' })
    await evento({ ...base, lead_id: soCheckout, session_id: 's_ab2', event: 'cta_click' })
    await registrarEventoProprio({ leadId: soCheckout, evento: EVENTOS.pixGenerated, metadata: { paymentId: 'MP-2' } })
    const vendas = await p.trackedConversion.count({ where: { userId: owner.id, leadId: soCheckout } })
    checa('PIX não pago não vira venda', vendas === 0, `conversoes=${vendas}`)
  }

  secao('8. Sessão retomada mantém a jornada')
  {
    await evento({ ...base, session_id: 's_jornada_2', event: 'page_view', utm: {}, click_ids: {}, creative: {} })
    const l = await p.trackedLead.findFirst({ where: { userId: owner.id, leadId: lead } })
    checa('origem original preservada na volta', l?.utmSource === 'facebook' && l?.fbclid === 'FB_ABC123',
      `utm=${l?.utmSource} fbclid=${l?.fbclid}`)
    const sessoes = await p.trackedSession.count({ where: { userId: owner.id, leadId: lead } })
    checa('nova sessão criada sob o mesmo lead', sessoes === 2, `sessoes=${sessoes}`)
  }

  secao('9. Reconstrução da jornada individual')
  {
    const eventos = await p.trackedEvent.findMany({
      where: { userId: owner.id, leadId: lead }, orderBy: { createdAt: 'asc' }, select: { eventName: true },
    })
    const seq = eventos.map(e => e.eventName)
    const esperado = ['page_view', 'cta_click', 'checkout_initiated', 'pix_generated']
    checa('sequência completa reconstruível', esperado.every(e => seq.includes(e)), seq.join(' → '))
    console.log('         jornada: ' + seq.join(' → '))
  }

  await p.user.deleteMany({ where: { email: EMAIL_OWNER } })
  console.log('\n  dados de teste removidos')
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${ok} passaram, ${bad} falharam`)
  console.log('='.repeat(60))
  await p.$disconnect()
  process.exit(bad ? 1 : 0)
}

main().catch(async e => { console.error('ERRO FATAL:', e); await p.$disconnect(); process.exit(1) })
