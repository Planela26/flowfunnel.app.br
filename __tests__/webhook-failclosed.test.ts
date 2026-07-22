import crypto from 'crypto'
import { guardWebhook } from '../lib/webhook-security'

let pass = 0
let fail = 0
function ok(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.log(`  ✗ ${label}`)
    fail++
  }
}

function hmac(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

async function main() {
  const body = JSON.stringify({ event: 'sale', id: 'evt_' + Date.now() })

  console.log('\n[1] requireSecret=true + secret AUSENTE → fail-closed (503), NÃO processa')
  for (const platform of ['eduzz', 'kiwify', 'monetizze', 'perfect-pay']) {
    const r = await guardWebhook({
      platform: `${platform}:test-missing-${Date.now()}`,
      rawBody: body,
      signature: 'qualquer-coisa',
      secret: undefined,
      headers: new Headers(),
      requireSecret: true,
    })
    ok(r.ok === false && (r as any).status === 503, `${platform}: secret ausente → 503 (rejeitado)`)
  }
  // String vazia também conta como ausente
  const empty = await guardWebhook({
    platform: `eduzz:empty-${Date.now()}`,
    rawBody: body,
    signature: 'x',
    secret: '',
    headers: new Headers(),
    requireSecret: true,
  })
  ok(empty.ok === false && (empty as any).status === 503, 'secret = "" → 503 (rejeitado)')

  console.log('\n[2] requireSecret=true + secret presente + assinatura INVÁLIDA → 403')
  const badSig = await guardWebhook({
    platform: `kiwify:badsig-${Date.now()}`,
    rawBody: body,
    signature: 'assinatura-errada',
    secret: 'shhh-secret',
    headers: new Headers(),
    requireSecret: true,
  })
  ok(badSig.ok === false && (badSig as any).status === 403, 'assinatura inválida → 403')

  console.log('\n[3] requireSecret=true + secret presente + assinatura AUSENTE → 403')
  const noSig = await guardWebhook({
    platform: `monetizze:nosig-${Date.now()}`,
    rawBody: body,
    signature: null,
    secret: 'shhh-secret',
    headers: new Headers(),
    requireSecret: true,
  })
  ok(noSig.ok === false && (noSig as any).status === 403, 'sem header de assinatura → 403')

  console.log('\n[4] requireSecret=true + secret presente + assinatura VÁLIDA → ok')
  const secret = 'shhh-secret'
  const goodBody = JSON.stringify({ event: 'sale', id: 'ok_' + Date.now() })
  const good = await guardWebhook({
    platform: `perfect-pay:good-${Date.now()}`,
    rawBody: goodBody,
    signature: hmac(goodBody, secret),
    secret,
    headers: new Headers(),
    requireSecret: true,
  })
  ok(good.ok === true, 'assinatura HMAC válida → aceito')

  console.log('\n[5] Backward-compat: requireSecret ausente + sem secret → fail-OPEN (Hotmart)')
  const legacyBody = JSON.stringify({ event: 'sale', id: 'legacy_' + Date.now() })
  const legacy = await guardWebhook({
    platform: `hotmart:legacy-${Date.now()}`,
    rawBody: legacyBody,
    signature: null,
    secret: null,
    headers: new Headers(),
  })
  ok(legacy.ok === true, 'sem requireSecret e sem secret → segue (Hotmart usa hottok)')

  console.log(`\n=== WEBHOOK FAIL-CLOSED: ${pass} passou, ${fail} falhou ===`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
