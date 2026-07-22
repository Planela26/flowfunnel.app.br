/**
 * Auditoria de conectividade externa — verificações READ-ONLY.
 * NÃO envia e-mails nem cria cobranças. Apenas valida que as credenciais
 * autenticam e que os serviços respondem.
 * Roda com: npx tsx scripts/connectivity-check.ts
 */
import { prismaAdmin } from '../lib/prisma'

type Res = { name: string; ok: boolean; info: string }
const results: Res[] = []
const add = (name: string, ok: boolean, info: string) => { results.push({ name, ok, info }) }

async function checkDb() {
  try {
    const r = await prismaAdmin.$queryRawUnsafe<any[]>('SELECT 1 as ok')
    add('PostgreSQL (DATABASE_URL)', Array.isArray(r) && r.length > 0, 'SELECT 1 OK')
  } catch (e: any) { add('PostgreSQL (DATABASE_URL)', false, e.message) }
}

async function checkStripe() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return add('Stripe', false, 'STRIPE_SECRET_KEY ausente')
    const { getUncachableStripeClient } = await import('../lib/stripeClient')
    const stripe = await getUncachableStripeClient()
    const bal = await stripe.balance.retrieve()
    add('Stripe (balance.retrieve)', !!bal, `livemode=${(bal as any).livemode}`)
  } catch (e: any) { add('Stripe (balance.retrieve)', false, e.message) }
}

async function checkOpenAI() {
  try {
    const key = process.env.OPENAI_API_KEY
    if (!key || key === 'demo-mode') return add('OpenAI', false, 'OPENAI_API_KEY ausente (modo demo)')
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } })
    add('OpenAI (GET /v1/models)', res.ok, `HTTP ${res.status}`)
  } catch (e: any) { add('OpenAI (GET /v1/models)', false, e.message) }
}

let resendDomainVerified: boolean | null = null
async function checkResend() {
  try {
    const key = process.env.RESEND_API_KEY
    if (!key) return add('Resend', false, 'RESEND_API_KEY ausente')
    const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } })
    add('Resend (GET /domains)', res.ok, `HTTP ${res.status}`)
    if (res.ok) {
      const body: any = await res.json()
      const list: any[] = body?.data ?? []
      const target = list.find((d) => String(d?.name).includes('flowfunnel'))
      resendDomainVerified = target?.status === 'verified'
      add('Resend domínio flowfunnel verificado (F3)', resendDomainVerified === true,
        target ? `status=${target.status}` : 'domínio não cadastrado')
    }
  } catch (e: any) { add('Resend (GET /domains)', false, e.message) }
}

async function checkMercadoPago() {
  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!token) return add('Mercado Pago', false, 'MERCADOPAGO_ACCESS_TOKEN ausente')
    const res = await fetch('https://api.mercadopago.com/v1/payment_methods', { headers: { Authorization: `Bearer ${token}` } })
    add('Mercado Pago (GET /v1/payment_methods)', res.ok, `HTTP ${res.status}`)
  } catch (e: any) { add('Mercado Pago (GET /v1/payment_methods)', false, e.message) }
}

// Auditoria de configuração (F2): webhooks de plataforma só EXIGEM assinatura
// HMAC quando o respectivo *_WEBHOOK_SECRET existe. Ausente = aceita não assinado.
function auditWebhookSecrets() {
  const required = ['STRIPE_WEBHOOK_SECRET', 'MERCADOPAGO_WEBHOOK_SECRET',
    'EDUZZ_WEBHOOK_SECRET', 'KIWIFY_WEBHOOK_SECRET', 'MONETIZZE_WEBHOOK_SECRET',
    'PERFECT_PAY_WEBHOOK_SECRET']
  console.log('\n=== AUDITORIA DE CONFIG (F2) — segredos de webhook ===')
  const missing: string[] = []
  for (const k of required) {
    const present = !!process.env[k]
    console.log(`  ${present ? '✓ configurado' : '✗ AUSENTE (aceita não assinado)'} — ${k}`)
    if (!present) missing.push(k)
  }
  return missing
}

async function main() {
  await Promise.all([checkDb(), checkStripe(), checkOpenAI(), checkResend(), checkMercadoPago()])
  console.log('\n=== CONECTIVIDADE EXTERNA (read-only) ===')
  let okc = 0
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name} — ${r.info}`)
    if (r.ok) okc++
  }
  console.log(`\n${okc}/${results.length} verificações OK`)
  const missing = auditWebhookSecrets()
  if (missing.length) console.log(`\n⚠️  F2: ${missing.length} segredo(s) de webhook ausente(s): ${missing.join(', ')}`)
  if (resendDomainVerified === false) console.log('⚠️  F3: domínio Resend NÃO verificado — e-mails a clientes não serão entregues.')
  await prismaAdmin.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
