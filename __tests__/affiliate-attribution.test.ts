/**
 * Testes de atribuição segura de afiliados (Fase 3 — cookie ff_attr).
 * Ver AFFILIATE_WALLET_ARCHITECTURE.md §18/§24.4.
 *
 * Cobre exclusivamente lib/affiliate-attribution.ts — módulo puro (sem DB),
 * mesma convenção de calculations.test.ts/totp.test.ts. As rotas
 * (app/api/affiliates/click, .../attribution, checkout) delegam inteiramente
 * para estas funções; não são invocadas aqui porque importam `next/headers`
 * (exige o runtime de request do Next.js, não roda fora dele) — mesma razão
 * pela qual affiliate-wallet.test.ts testa lib/affiliate-ledger.ts em vez
 * das rotas HTTP.
 *
 * Roda com: `npx tsx __tests__/affiliate-attribution.test.ts`
 */
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-affiliate-attribution-only'

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import {
  signAttributionCookie,
  verifyAttributionCookie,
  getAttributionAffiliateId,
  setAttributionCookie,
  resolveCheckoutAffiliateId,
  ATTRIBUTION_COOKIE_NAME,
  ATTRIBUTION_MAX_AGE_SECONDS,
} from '../lib/affiliate-attribution'

let passed = 0
let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.error(`  ✗ ${name}`) }
}

// Reimplementa o formato do módulo (base64(JSON) + "." + HMAC-SHA256("ff_attr:"+payload))
// para forjar cookies de teste (payload arbitrário, inclusive vencido) sem
// precisar exportar os internos do módulo.
function craftCookie(payload: object, secret = process.env.NEXTAUTH_SECRET!): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  const sig = crypto.createHmac('sha256', secret).update(`ff_attr:${encoded}`).digest('hex')
  return `${encoded}.${sig}`
}

function requestWithCookie(cookieValue: string | null): Request {
  const headers: Record<string, string> = {}
  if (cookieValue !== null) headers['cookie'] = `${ATTRIBUTION_COOKIE_NAME}=${cookieValue}`
  return new Request('https://flowsara.app.br/api/test', { method: 'POST', headers })
}

function main() {
  const AFFILIATE_A = 'aff_A_1234567890'
  const AFFILIATE_B = 'aff_B_0987654321'

  // === 1) Cookie válido ====================================================
  console.log('\n[1] Cookie válido')
  const validCookie = signAttributionCookie(AFFILIATE_A)
  check('formato tem exatamente um separador "."', validCookie.split('.').length === 2)
  check('verifyAttributionCookie devolve o affiliateId correto', verifyAttributionCookie(validCookie) === AFFILIATE_A)
  check('getAttributionAffiliateId lê do header Cookie corretamente', getAttributionAffiliateId(requestWithCookie(validCookie)) === AFFILIATE_A)

  // === 2) Cookie adulterado ================================================
  console.log('\n[2] Cookie adulterado (HMAC)')
  const [encodedPart, sigPart] = validCookie.split('.')
  const tamperedSig = sigPart.slice(0, -1) + (sigPart.slice(-1) === 'a' ? 'b' : 'a')
  check('assinatura alterada em 1 char → rejeitado', verifyAttributionCookie(`${encodedPart}.${tamperedSig}`) === null)

  const tamperedPayloadObj = JSON.parse(Buffer.from(encodedPart, 'base64').toString('utf8'))
  tamperedPayloadObj.affiliateId = AFFILIATE_B // tenta trocar o afiliado mantendo a assinatura antiga
  const tamperedEncoded = Buffer.from(JSON.stringify(tamperedPayloadObj)).toString('base64')
  check('payload trocado sem re-assinar → rejeitado', verifyAttributionCookie(`${tamperedEncoded}.${sigPart}`) === null)

  check('assinado com segredo ERRADO → rejeitado', verifyAttributionCookie(craftCookie({
    affiliateId: AFFILIATE_A, issuedAt: Date.now(), expiresAt: Date.now() + 1000,
  }, 'segredo-errado')) === null)

  // === 3) Cookie expirado ===================================================
  console.log('\n[3] Cookie expirado')
  const expiredCookie = craftCookie({
    affiliateId: AFFILIATE_A,
    issuedAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() - 1000, // venceu há 1s — assinatura válida, mas fora da janela
  })
  check('expiresAt no passado → rejeitado mesmo com assinatura válida', verifyAttributionCookie(expiredCookie) === null)

  const freshCookie = craftCookie({
    affiliateId: AFFILIATE_A,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000,
  })
  check('expiresAt no futuro próximo → aceito', verifyAttributionCookie(freshCookie) === AFFILIATE_A)

  // === 4) Ausência de cookie / malformado ==================================
  console.log('\n[4] Ausência de cookie / payload malformado')
  check('cookie null → null', verifyAttributionCookie(null) === null)
  check('cookie undefined → null', verifyAttributionCookie(undefined) === null)
  check('string vazia → null', verifyAttributionCookie('') === null)
  check('sem separador "." → null', verifyAttributionCookie('semponto') === null)
  check('base64 não-JSON → null', verifyAttributionCookie(`${Buffer.from('não é json').toString('base64')}.${'a'.repeat(64)}`) === null)
  check('payload sem affiliateId → null', verifyAttributionCookie(craftCookie({ issuedAt: 1, expiresAt: Date.now() + 1000 })) === null)
  check('request sem header Cookie → getAttributionAffiliateId null', getAttributionAffiliateId(requestWithCookie(null)) === null)
  check('resolveCheckoutAffiliateId sem frozen e sem cookie → null (checkout orgânico)', resolveCheckoutAffiliateId({
    request: requestWithCookie(null),
  }) === null)

  // === 5) Checkout com affiliateId forjado no corpo ========================
  console.log('\n[5] affiliateId forjado no corpo da requisição')
  const forgedBodyRequest = new Request('https://flowsara.app.br/api/stripe/create-subscription', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: '' }, // nenhum cookie válido
    body: JSON.stringify({ plan: 'PRO', affiliateId: AFFILIATE_A }), // corpo tenta forjar A
  })
  check(
    'resolveCheckoutAffiliateId ignora completamente o corpo (não lê request.json())',
    resolveCheckoutAffiliateId({ request: forgedBodyRequest }) === null,
  )

  // === 6) Usuário com referredByAffiliateId já congelado ===================
  console.log('\n[6] Atribuição já congelada')
  const reqWithDifferentCookie = requestWithCookie(signAttributionCookie(AFFILIATE_B))
  check(
    'frozenAffiliateId vence mesmo com cookie válido de OUTRO afiliado',
    resolveCheckoutAffiliateId({ request: reqWithDifferentCookie, frozenAffiliateId: AFFILIATE_A }) === AFFILIATE_A,
  )
  check(
    'sem frozen, cookie válido é usado como fallback',
    resolveCheckoutAffiliateId({ request: reqWithDifferentCookie, frozenAffiliateId: null }) === AFFILIATE_B,
  )
  check(
    'frozen null/undefined tratado igual (nenhum congelamento) — cai pro cookie',
    resolveCheckoutAffiliateId({ request: reqWithDifferentCookie }) === AFFILIATE_B,
  )

  // === 7) Último clique válido ==============================================
  console.log('\n[7] Último clique — cookie mais recente prevalece')
  const cookieClick1 = signAttributionCookie(AFFILIATE_A)
  const cookieClick2 = signAttributionCookie(AFFILIATE_B) // "segundo clique" — Set-Cookie substituiria o primeiro no navegador
  check('primeiro clique resolve para A', getAttributionAffiliateId(requestWithCookie(cookieClick1)) === AFFILIATE_A)
  check('cookie do segundo clique (o que o navegador teria após o 2º Set-Cookie) resolve para B', getAttributionAffiliateId(requestWithCookie(cookieClick2)) === AFFILIATE_B)
  check('os dois cookies são independentes (não colidem/misturam)', cookieClick1 !== cookieClick2)

  // === 8) Flags do cookie (Set-Cookie) ======================================
  console.log('\n[8] Flags do cookie na resposta')
  const originalEnv = process.env.NODE_ENV
  const response = NextResponse.json({ ok: true })
  setAttributionCookie(response, AFFILIATE_A)
  const setCookieHeader = response.headers.get('set-cookie') || ''
  check('nome do cookie é ff_attr', setCookieHeader.startsWith(`${ATTRIBUTION_COOKIE_NAME}=`))
  check('HttpOnly presente', /HttpOnly/i.test(setCookieHeader))
  check('SameSite=Lax presente', /SameSite=Lax/i.test(setCookieHeader))
  check('Path=/ presente', /Path=\//i.test(setCookieHeader))
  check(`Max-Age = ${ATTRIBUTION_MAX_AGE_SECONDS} (30 dias)`, new RegExp(`Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}\\b`, 'i').test(setCookieHeader))
  check('ATTRIBUTION_MAX_AGE_SECONDS corresponde a 30 dias', ATTRIBUTION_MAX_AGE_SECONDS === 30 * 24 * 60 * 60)

  const cookieObj = response.cookies.get(ATTRIBUTION_COOKIE_NAME)
  check('valor gravado é verificável e resolve para o afiliado certo', !!cookieObj && verifyAttributionCookie(cookieObj.value) === AFFILIATE_A)
  ;(process.env as any).NODE_ENV = originalEnv

  console.log(`\n=== Atribuição de afiliados: ${passed} passou, ${failed} falhou ===`)
  if (failed > 0) process.exit(1)
}

main()
