import { base32Encode, base32Decode, generateTOTP, verifyTOTP, generateTotpSecret, buildOtpauthUri } from '../lib/totp'
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from '../lib/recovery-codes'
import { checkTwoFactorCode, evaluateTwoFactor } from '../lib/two-factor-verify'

function expectEq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected && !(Number.isNaN(actual) && Number.isNaN(expected))) {
    throw new Error(`${msg} — esperado ${String(expected)}, recebido ${String(actual)}`)
  }
}

// Vetores oficiais da RFC 6238 (Appendix B) — SHA-1, seed ASCII
// "12345678901234567890", 8 dígitos, passo 30s.
const RFC_SEED_ASCII = '12345678901234567890'
const RFC_SECRET_B32 = base32Encode(Buffer.from(RFC_SEED_ASCII, 'ascii'))
const STEP = 30
const rfc = (t: number) => generateTOTP(RFC_SECRET_B32, t, { digits: 8, step: STEP })

const tests: Array<[string, () => void]> = [
  // ── Base32 ──
  ['base32 roundtrip preserva bytes', () => {
    const buf = Buffer.from('Hello 2FA world!', 'utf8')
    expectEq(base32Decode(base32Encode(buf)).toString('utf8'), 'Hello 2FA world!', 'roundtrip')
  }],
  ['base32 do seed RFC bate', () =>
    expectEq(RFC_SECRET_B32, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'seed RFC')],

  // ── Vetores RFC 6238 ──
  ['RFC 6238 T=59 → 94287082',         () => expectEq(rfc(59), '94287082', 'vetor 59')],
  ['RFC 6238 T=1111111109 → 07081804', () => expectEq(rfc(1111111109), '07081804', 'vetor 1111111109')],
  ['RFC 6238 T=1111111111 → 14050471', () => expectEq(rfc(1111111111), '14050471', 'vetor 1111111111')],
  ['RFC 6238 T=1234567890 → 89005924', () => expectEq(rfc(1234567890), '89005924', 'vetor 1234567890')],
  ['RFC 6238 T=2000000000 → 69279037', () => expectEq(rfc(2000000000), '69279037', 'vetor 2000000000')],

  // ── verifyTOTP ──
  ['verifyTOTP aceita código atual', () => {
    const secret = generateTotpSecret()
    const now = Math.floor(Date.now() / 1000)
    const code = generateTOTP(secret, now)
    expectEq(verifyTOTP(code, secret, { timeSeconds: now }), true, 'código válido')
  }],
  ['verifyTOTP rejeita código inválido', () => {
    const secret = generateTotpSecret()
    expectEq(verifyTOTP('000000', secret, { timeSeconds: 1111111111 }), false, 'código inválido')
  }],
  ['verifyTOTP aceita deriva de ±1 passo', () => {
    const secret = generateTotpSecret()
    const now = Math.floor(Date.now() / 1000)
    const codePrev = generateTOTP(secret, now - STEP)
    expectEq(verifyTOTP(codePrev, secret, { timeSeconds: now }), true, 'janela de drift')
  }],
  ['verifyTOTP rejeita código EXPIRADO (fora da janela)', () => {
    const secret = generateTotpSecret()
    const t = 1111111111
    const oldCode = generateTOTP(secret, t)
    // 4 passos depois (120s) está fora da janela ±1 → deve falhar.
    expectEq(verifyTOTP(oldCode, secret, { timeSeconds: t + STEP * 4 }), false, 'código expirado')
  }],

  // ── otpauth URI ──
  ['otpauth URI contém secret e issuer', () => {
    const uri = buildOtpauthUri({ secretBase32: 'ABC234', accountName: 'a@b.com', issuer: 'FlowFunnel' })
    expectEq(uri.startsWith('otpauth://totp/'), true, 'prefixo otpauth')
    expectEq(uri.includes('secret=ABC234'), true, 'contém secret')
    expectEq(uri.includes('issuer=FlowFunnel'), true, 'contém issuer')
  }],

  // ── Recovery codes ──
  ['gera 10 códigos no formato XXXXX-XXXXX', () => {
    const { codes, hashes } = generateRecoveryCodes()
    expectEq(codes.length, 10, '10 códigos')
    expectEq(hashes.length, 10, '10 hashes')
    expectEq(codes.every((c) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(c)), true, 'formato')
    expectEq(new Set(codes).size, 10, 'códigos únicos')
  }],
  ['hash de recovery é estável e normaliza caixa/hífen', () => {
    const code = 'ABCDE-FGHJK'
    expectEq(hashRecoveryCode(code), hashRecoveryCode('abcde fghjk'), 'normalização')
    expectEq(normalizeRecoveryCode(' ab-cd ef '), 'ABCDEF', 'normalize')
  }],

  // ── checkTwoFactorCode (decisão de login) ──
  ['login 2FA: TOTP válido → method totp', () => {
    const secret = generateTotpSecret()
    const code = generateTOTP(secret)
    const r = checkTwoFactorCode({ code, secretBase32: secret, recoveryHashes: [] })
    expectEq(r.ok, true, 'ok')
    expectEq(r.ok && r.method, 'totp', 'método totp')
  }],
  ['login 2FA: código inválido → ok false', () => {
    const secret = generateTotpSecret()
    const r = checkTwoFactorCode({ code: '123456', secretBase32: secret, recoveryHashes: [] })
    // Praticamente impossível '123456' bater no instante atual; se bater, o teste
    // detecta um falso positivo real. Aceitamos o risco ínfimo (1 em ~1M).
    expectEq(r.ok, false, 'inválido')
  }],
  ['login 2FA: código de recuperação válido → method recovery', () => {
    const { codes, hashes } = generateRecoveryCodes()
    const r = checkTwoFactorCode({ code: codes[3], secretBase32: generateTotpSecret(), recoveryHashes: hashes })
    expectEq(r.ok, true, 'ok recovery')
    expectEq(r.ok && r.method, 'recovery', 'método recovery')
    expectEq(r.ok && r.usedRecoveryHash, hashRecoveryCode(codes[3]), 'hash usado correto')
  }],
  ['login 2FA: recovery code já consumido não é aceito', () => {
    const { codes, hashes } = generateRecoveryCodes()
    // Simula que o código 0 foi removido da lista de não-usados.
    const remaining = hashes.filter((h) => h !== hashRecoveryCode(codes[0]))
    const r = checkTwoFactorCode({ code: codes[0], secretBase32: generateTotpSecret(), recoveryHashes: remaining })
    expectEq(r.ok, false, 'consumido rejeitado')
  }],
  ['login 2FA: código vazio → reason no_code', () => {
    const r = checkTwoFactorCode({ code: '', secretBase32: generateTotpSecret(), recoveryHashes: [] })
    expectEq(r.ok, false, 'vazio')
    expectEq(!r.ok && r.reason, 'no_code', 'reason no_code')
  }],

  // ── evaluateTwoFactor (conta sem 2FA) ──
  ['conta sem 2FA: passa sem exigir código', () => {
    const r = evaluateTwoFactor({ enabled: false, code: '', secretBase32: null, recoveryHashes: [] })
    expectEq(r.ok, true, 'ok')
    expectEq(r.ok && r.method, 'not_required', 'not_required')
  }],
  ['conta com 2FA sem código → falha', () => {
    const r = evaluateTwoFactor({ enabled: true, code: '', secretBase32: generateTotpSecret(), recoveryHashes: [] })
    expectEq(r.ok, false, 'exige código')
  }],
]

let pass = 0, fail = 0
for (const [name, fn] of tests) {
  try { fn(); console.log('✓', name); pass++ } catch (e) { console.error('✗', name, '—', (e as Error).message); fail++ }
}
console.log(`\n${pass}/${tests.length} OK${fail ? `, ${fail} FALHAS` : ''}`)
if (fail) process.exit(1)
