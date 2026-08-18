/**
 * Laboratório da Sara.ai — autorização real e números corretos.
 *
 * Roda com: npx tsx __tests__/owner-lab-access.live.ts
 * Exige o dev server em :5000 e o banco de TESTE.
 *
 * O ponto central destes testes: "não basta esconder o botão". Um segundo
 * ADMIN (papel de suporte, por exemplo) e um usuário comum devem ser
 * recusados pelo BACKEND, não apenas não ver o link no menu.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const p = new PrismaClient()
const BASE = 'http://localhost:5000'
const SENHA = 'TesteSara#2026'

const EMAIL_OWNER = 'lab-owner@test.local'
const EMAIL_SEGUNDO_ADMIN = 'lab-segundo-admin@test.local'
const EMAIL_USUARIO = 'lab-usuario@test.local'

let ok = 0, bad = 0
function checa(n: string, c: boolean, d?: string) {
  if (c) { ok++; console.log('  PASS  ' + n) }
  else { bad++; console.log('  FALHA ' + n + (d ? '\n        ' + d : '')) }
}
const secao = (t: string) => console.log(`\n── ${t}`)

function pega(res: Response, jar: Record<string, string>) {
  for (const c of (res.headers.getSetCookie?.() ?? [])) {
    const kv = c.split(';')[0]; const i = kv.indexOf('=')
    if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim()
  }
}
const hdr = (j: Record<string, string>) => Object.entries(j).map(([k, v]) => `${k}=${v}`).join('; ')

async function login(email: string) {
  const jar: Record<string, string> = {}
  const r1 = await fetch(`${BASE}/api/auth/csrf`); pega(r1, jar)
  const { csrfToken } = await r1.json()
  pega(await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: hdr(jar) },
    body: new URLSearchParams({ csrfToken, email, password: SENHA, json: 'true' }), redirect: 'manual',
  }), jar)
  const s = await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: hdr(jar) } })).json()
  if (!s?.user) throw new Error('login falhou: ' + email)
  return jar
}
const api = (jar: Record<string, string>, c: string) =>
  fetch(`${BASE}${c}`, { headers: { Cookie: hdr(jar) } })

async function main() {
  await p.user.deleteMany({ where: { email: { in: [EMAIL_OWNER, EMAIL_SEGUNDO_ADMIN, EMAIL_USUARIO] } } })
  const hash = await bcrypt.hash(SENHA, 12)

  // Owner: ADMIN mais antigo — createdAt bem no passado para não depender de
  // quem mais existe no banco compartilhado de teste.
  const owner = await p.user.create({
    data: { email: EMAIL_OWNER, name: 'Owner', role: 'ADMIN', password: hash, emailVerified: new Date(), createdAt: new Date('2018-01-01') },
  })
  process.env.OWNER_TRACKING_USER_ID = owner.id

  const segundoAdmin = await p.user.create({
    data: { email: EMAIL_SEGUNDO_ADMIN, name: 'Suporte', role: 'ADMIN', password: hash, emailVerified: new Date() },
  })
  const usuario = await p.user.create({
    data: { email: EMAIL_USUARIO, name: 'Cliente', role: 'PRODUTOR', plan: 'START', password: hash, emailVerified: new Date() },
  })

  // Semeia uma jornada completa sob a conta Owner.
  const lead = 'l_lab_' + Date.now()
  await p.trackedLead.create({
    data: { userId: owner.id, leadId: lead, visitorId: 'v_lab', utmSource: 'facebook', utmCampaign: 'Camp X', adId: 'AD_1' },
  })
  for (const nome of ['page_view', 'scroll_50', 'cta_click', 'checkout_initiated', 'pix_generated']) {
    await p.trackedEvent.create({ data: { userId: owner.id, leadId: lead, eventName: nome } })
  }
  await p.trackedConversion.create({
    data: { userId: owner.id, leadId: lead, orderId: 'LAB-1', platform: 'mercadopago', value: 97, product: 'START' },
  })
  await p.saleAttribution.create({
    data: {
      userId: owner.id, platform: 'mercadopago', transactionId: 'LAB-1', leadId: lead,
      method: 'deterministic', confidence: 1, utmCampaign: 'Camp X', value: 97,
      metadata: JSON.stringify({ adId: 'AD_1' }),
    },
  })

  const O = await login(EMAIL_OWNER)
  const S = await login(EMAIL_SEGUNDO_ADMIN)
  const U = await login(EMAIL_USUARIO)

  secao('Autorização real — não basta esconder o menu')
  for (const rota of ['/api/owner/funnel', '/api/owner/journeys', `/api/owner/journeys/${lead}`]) {
    const r1 = await api(U, rota)
    checa(`usuário comum recebe 403 em ${rota}`, r1.status === 403, `veio ${r1.status}`)
    const r2 = await api(S, rota)
    checa(`SEGUNDO admin (não-owner) recebe 403 em ${rota}`, r2.status === 403, `veio ${r2.status}`)
  }
  {
    const r = await fetch(`${BASE}/api/owner/funnel`)
    checa('anônimo não acessa', r.status === 403 || r.status === 401, `veio ${r.status}`)
  }

  secao('Owner acessa e os números batem com o banco')
  {
    const r = await api(O, '/api/owner/funnel?days=30')
    checa('200 para o owner', r.status === 200, `veio ${r.status}`)
    const b = await r.json()
    const visitas = b.passos.find((p: any) => p.chave === 'visitas')
    const compras = b.passos.find((p: any) => p.chave === 'compras')
    checa('degrau de visitas correto', visitas?.total === 1, `total=${visitas?.total}`)
    checa('degrau de compras correto', compras?.total === 1, `total=${compras?.total}`)
    checa('receita bate com a venda semeada', b.receita === 97, `receita=${b.receita}`)
    checa('origem Meta Ads aparece', b.origens.some((o: any) => o.nome === 'Meta Ads'), JSON.stringify(b.origens))
    checa('anúncio AD_1 aparece na receita por criativo', b.anuncios.some((a: any) => a.adId === 'AD_1' && a.receita === 97), JSON.stringify(b.anuncios))
  }

  secao('Jornada individual — lista e detalhe')
  {
    const r = await api(O, '/api/owner/journeys')
    const b = await r.json()
    const j = b.jornadas.find((x: any) => x.leadId === lead)
    checa('jornada aparece na lista', !!j, 'nao encontrada')
    checa('marcada como comprou', j?.comprou === true, `comprou=${j?.comprou}`)

    const rd = await api(O, `/api/owner/journeys/${lead}`)
    checa('detalhe responde 200', rd.status === 200, `veio ${rd.status}`)
    const bd = await rd.json()
    const seq = bd.linha.map((e: any) => e.evento)
    checa('sequência completa e em ordem', seq.join(',') === 'page_view,scroll_50,cta_click,checkout_initiated,pix_generated', seq.join(','))
    checa('venda anexada ao detalhe', bd.venda?.valorFormatado?.includes('97'), JSON.stringify(bd.venda))
  }
  {
    const r = await api(O, '/api/owner/journeys/lead-que-nao-existe')
    checa('lead inexistente -> 404', r.status === 404, `veio ${r.status}`)
  }

  await p.user.deleteMany({ where: { email: { in: [EMAIL_OWNER, EMAIL_SEGUNDO_ADMIN, EMAIL_USUARIO] } } })
  console.log('\n  dados de teste removidos')
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${ok} passaram, ${bad} falharam`)
  console.log('='.repeat(60))
  await p.$disconnect()
  process.exit(bad ? 1 : 0)
}

main().catch(async e => { console.error('ERRO FATAL:', e); await p.$disconnect(); process.exit(1) })
