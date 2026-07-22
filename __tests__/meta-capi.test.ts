// Run: npx tsx __tests__/meta-capi.test.ts
import assert from 'node:assert'
import { sendMetaCapiEvent, readFbCookies } from '../lib/meta-capi'

let passed = 0
let failed = 0
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`✅ ${name}`) })
    .catch((e) => { failed++; console.error(`❌ ${name}:`, e.message) })
}

async function main() {
  // 1. No-op + skipped when META_ACCESS_TOKEN is empty/missing.
  await test('sendMetaCapiEvent no-ops gracefully without token', async () => {
    const prev = process.env.META_ACCESS_TOKEN
    delete process.env.META_ACCESS_TOKEN
    const res = await sendMetaCapiEvent({
      eventName: 'Purchase',
      eventId: 'purchase_test_1',
      userData: { email: 'test@example.com' },
      customData: { value: 97, currency: 'BRL' },
    })
    if (prev !== undefined) process.env.META_ACCESS_TOKEN = prev
    assert.strictEqual(res.skipped, true, 'should be skipped')
    assert.strictEqual(res.ok, false, 'should not be ok without token')
  })

  // 2. readFbCookies parses _fbp / _fbc from a Cookie header.
  await test('readFbCookies extracts _fbp and _fbc', () => {
    const h = new Headers()
    h.set('cookie', 'foo=bar; _fbp=fb.1.123.456; _fbc=fb.1.789.abc; baz=qux')
    const { fbp, fbc } = readFbCookies(h)
    assert.strictEqual(fbp, 'fb.1.123.456')
    assert.strictEqual(fbc, 'fb.1.789.abc')
  })

  // 3. readFbCookies returns empty when no fb cookies present.
  await test('readFbCookies returns empty when absent', () => {
    const h = new Headers()
    h.set('cookie', 'foo=bar')
    const { fbp, fbc } = readFbCookies(h)
    assert.strictEqual(fbp, undefined)
    assert.strictEqual(fbc, undefined)
  })

  console.log(`\n${passed} passou, ${failed} falhou`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
