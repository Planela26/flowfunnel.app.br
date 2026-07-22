/**
 * Auditoria de integração AO VIVO — exercita os endpoints reais do app em
 * execução (porta 5000) com dados semeados via prismaAdmin e cookie JWT NextAuth.
 * Valida: cálculo de uso, relatório (receita + dedup + cancelamento), isolamento
 * multi-tenant via HTTP, e fail-closed dos webhooks de pagamento.
 *
 * Pré-requisito: workflow "Start application" rodando.
 * Roda com: npx tsx __tests__/integration.live.ts
 */
import { prismaAdmin } from '../lib/prisma'
import { encode } from 'next-auth/jwt'
import bcrypt from 'bcryptjs'

const DOMAIN = process.env.REPLIT_DEV_DOMAIN!
const SECRET = process.env.NEXTAUTH_SECRET!
const BASE = `https://${DOMAIN}`

let pass = 0, fail = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; failures.push(name); console.error('  ✗', name, detail) }
}

async function cookieFor(userId: string, role = 'PRODUTOR', email = '') {
  const token = await encode({ token: { id: userId, role, email, emailVerified: new Date() }, secret: SECRET })
  return `__Secure-next-auth.session-token=${token}`
}

async function main() {
  const stamp = Date.now()
  const created: string[] = []

  // ---- Seed tenant A (PRO) ----
  const userA = await prismaAdmin.user.create({ data: {
    email: `audit-a-${stamp}@gmail.com`, name: 'Audit A', plan: 'PRO', emailVerified: new Date(),
  }})
  created.push(userA.id)
  // 5 conversas WhatsApp neste mês
  for (let i = 0; i < 5; i++) {
    await prismaAdmin.webhookLog.create({ data: {
      userId: userA.id, platform: 'WHATSAPP', event: 'message', method: 'POST',
      endpoint: '/api/webhooks/whatsapp', statusCode: 200, payload: '{}',
    }})
  }
  const funnelA = await prismaAdmin.funnel.create({ data: {
    userId: userA.id, name: 'Funil A', description: 'audit', startDate: new Date(),
    stages: { create: [{ name: 'Pago', order: 1 }] },
  }, include: { stages: true } })
  const stageA = funnelA.stages[0].id
  const now = new Date()
  const sale = (amount: number, tx: string, status?: string) => ({
    funnelId: funnelA.id, stageId: stageA, eventType: 'hotmart_purchase_complete', timestamp: now,
    metadata: JSON.stringify({ amount, transactionId: tx, ...(status ? { status } : {}) }),
  })
  await prismaAdmin.funnelEvent.create({ data: sale(197, 'TX-A1') })
  await prismaAdmin.funnelEvent.create({ data: sale(297, 'TX-A2') })
  await prismaAdmin.funnelEvent.create({ data: sale(197, 'TX-A1') })          // duplicata → deve deduplicar
  await prismaAdmin.funnelEvent.create({ data: sale(999, 'TX-A3', 'refunded') }) // cancelada → excluir

  // ---- Seed tenant B ----
  const userB = await prismaAdmin.user.create({ data: {
    email: `audit-b-${stamp}@gmail.com`, name: 'Audit B', plan: 'PRO', emailVerified: new Date(),
  }})
  created.push(userB.id)
  const funnelB = await prismaAdmin.funnel.create({ data: {
    userId: userB.id, name: 'Funil B', description: 'audit', startDate: new Date(),
    stages: { create: [{ name: 'Pago', order: 1 }] },
  }, include: { stages: true } })
  await prismaAdmin.funnelEvent.create({ data: {
    funnelId: funnelB.id, stageId: funnelB.stages[0].id, eventType: 'hotmart_purchase_complete', timestamp: now,
    metadata: JSON.stringify({ amount: 5000, transactionId: 'TX-B1' }),
  }})

  const ckA = await cookieFor(userA.id, 'PRODUTOR', userA.email)

  try {
    // === 1) /api/usage ===
    console.log('\n[1] /api/usage (cálculo de consumo)')
    const u = await fetch(`${BASE}/api/usage`, { headers: { cookie: ckA } })
    const ub = await u.json()
    ok('status 200', u.status === 200, String(u.status))
    ok('plano PRO', ub.plan === 'PRO', JSON.stringify(ub))
    ok('limite 3000', ub.limit === 3000)
    ok('used = 5 (filtrado por tenant)', ub.used === 5, `used=${ub.used}`)
    ok('remaining = 2995', ub.remaining === 2995, `rem=${ub.remaining}`)

    // === 2) /api/reports (receita + dedup + cancelamento) ===
    console.log('\n[2] /api/reports (receita / dedup / cancelamento)')
    const r = await fetch(`${BASE}/api/reports?days=30`, { headers: { cookie: ckA } })
    const rb = await r.json()
    ok('status 200', r.status === 200, String(r.status))
    ok('totalSales = 2 (duplicata deduplicada, refund excluído)', rb.summary?.totalSales === 2, `sales=${rb.summary?.totalSales}`)
    ok('totalRevenue = 494 (197+297; refund 999 fora)', rb.summary?.totalRevenue === 494, `rev=${rb.summary?.totalRevenue}`)

    // === 3) Isolamento multi-tenant via HTTP ===
    console.log('\n[3] Isolamento multi-tenant (HTTP)')
    ok('receita de A não inclui venda de B (5000)', rb.summary?.totalRevenue === 494, `rev=${rb.summary?.totalRevenue}`)
    const uB = await fetch(`${BASE}/api/usage`, { headers: { cookie: await cookieFor(userB.id, 'PRODUTOR', userB.email) } })
    const ubB = await uB.json()
    ok('B vê seu próprio uso (0 conversas)', ubB.used === 0, `usedB=${ubB.used}`)

    // === 4) Webhooks fail-closed ===
    console.log('\n[4] Webhooks (fail-closed / assinatura)')
    const mp = await fetch(`${BASE}/api/webhooks/mercadopago`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { id: '123' }, type: 'payment' }) })
    ok('Mercado Pago sem x-signature → 401', mp.status === 401, `status=${mp.status}`)
    const sw = await fetch(`${BASE}/api/stripe/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    ok('Stripe sem stripe-signature → 400', sw.status === 400, `status=${sw.status}`)

    // === 5) Auth: registro real → senha persistida como hash bcrypt ===
    console.log('\n[5] Auth (registro real / hash persistido no banco)')
    const weak = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'X', email: `weak-${stamp}@gmail.com`, password: '123' }) })
    ok('register senha fraca → 400', weak.status === 400, `status=${weak.status}`)

    const regEmail = `audit-reg-${stamp}@gmail.com`
    const reg = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Reg', email: regEmail, password: 'Senha123' }) })
    ok('register válido → 2xx', reg.ok, `status=${reg.status}`)
    const regUser = await prismaAdmin.user.findUnique({ where: { email: regEmail }, select: { id: true, password: true } })
    if (regUser) created.push(regUser.id)
    ok('usuário persistido no banco', !!regUser)
    ok('senha NÃO armazenada em texto puro', regUser?.password !== 'Senha123')
    ok('senha armazenada como hash bcrypt ($2*)', !!regUser?.password && /^\$2[aby]\$/.test(regUser.password!))
    ok('hash bcrypt confere com a senha original', !!regUser?.password && await bcrypt.compare('Senha123', regUser.password!))
    const dup = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Reg2', email: regEmail, password: 'Senha123' }) })
    ok('e-mail duplicado → 400 (unicidade)', dup.status === 400, `status=${dup.status}`)

    // === 6) Rota autenticada sem cookie → 401 ===
    console.log('\n[6] Proteção de rota autenticada')
    const noauth = await fetch(`${BASE}/api/usage`)
    ok('/api/usage sem sessão → 401', noauth.status === 401, `status=${noauth.status}`)
  } finally {
    // cleanup
    for (const id of created) {
      await prismaAdmin.funnelEvent.deleteMany({ where: { funnel: { userId: id } } }).catch(() => {})
      await prismaAdmin.funnel.deleteMany({ where: { userId: id } }).catch(() => {})
      await prismaAdmin.webhookLog.deleteMany({ where: { userId: id } }).catch(() => {})
      await prismaAdmin.emailVerificationToken.deleteMany({ where: { userId: id } }).catch(() => {})
      await prismaAdmin.auditLog.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prismaAdmin.user.delete({ where: { id } }).catch(() => {})
    }
    await prismaAdmin.$disconnect()
  }

  console.log(`\n=== INTEGRAÇÃO: ${pass} passou, ${fail} falhou ===`)
  if (fail) { console.error('FALHAS:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1) })
