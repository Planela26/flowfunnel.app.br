/**
 * Testes para IdGeneratorService e utilitários de ID público.
 * Usa o mesmo runner customizado do projeto (sem dependência de Jest).
 *
 * Executar: npx ts-node --project tsconfig.json __tests__/id-generator.test.ts
 * Ou via Jest (se configurado): npx jest __tests__/id-generator.test.ts
 */

import {
  CHARSET,
  PREFIX,
  buildPublicId,
  isValidPublicId,
  extractPrefix,
  IdGeneratorService,
} from '../lib/id-generator'

// ── Mini test runner (mesmo padrão de metrics.test.ts) ────────────────────────

let passed = 0
let failed = 0

function eq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`  ✗ FAIL: ${label}`)
    console.error(`       expected: ${JSON.stringify(expected)}`)
    console.error(`       received: ${JSON.stringify(actual)}`)
    failed++
  } else {
    console.log(`  ✓ ${label}`)
    passed++
  }
}

function ok(condition: boolean, label: string): void {
  eq(condition, true, label)
}

function suite(name: string, fn: () => void): void {
  console.log(`\n${name}`)
  fn()
}

const CHARSET_SET = new Set(CHARSET.split(''))
const FORBIDDEN   = ['O', '0', 'I', '1', 'L']

// ── 1. Charset ────────────────────────────────────────────────────────────────

suite('CHARSET', () => {
  eq(CHARSET.length, 31, 'contém exatamente 31 caracteres')
  for (const ch of FORBIDDEN) {
    ok(!CHARSET.includes(ch), `não contém caractere proibido '${ch}'`)
  }
  eq(new Set(CHARSET.split('')).size, CHARSET.length, 'todos os caracteres são únicos')
  ok(/^[A-Z2-9]+$/.test(CHARSET), 'contém apenas maiúsculas e dígitos permitidos')
})

// ── 2. randomCode ─────────────────────────────────────────────────────────────

suite('_randomCode()', () => {
  eq(IdGeneratorService._randomCode().length, 6, 'comprimento padrão é 6')
  for (const len of [8, 10, 12]) {
    eq(IdGeneratorService._randomCode(len).length, len, `comprimento customizado ${len}`)
  }

  let onlyCharset = true
  for (let i = 0; i < 200; i++) {
    for (const ch of IdGeneratorService._randomCode()) {
      if (!CHARSET_SET.has(ch)) { onlyCharset = false; break }
    }
  }
  ok(onlyCharset, 'usa apenas caracteres do CHARSET em 200 gerações')

  let noForbidden = true
  for (let i = 0; i < 1000; i++) {
    const code = IdGeneratorService._randomCode()
    for (const f of FORBIDDEN) {
      if (code.includes(f)) { noForbidden = false; break }
    }
  }
  ok(noForbidden, 'não contém caracteres proibidos em 1000 gerações')

  const seen = new Set<string>()
  for (let i = 0; i < 500; i++) {
    for (const ch of IdGeneratorService._randomCode()) seen.add(ch)
  }
  ok(seen.size > 28, `distribuição cobre > 28 chars únicos (cobriu ${seen.size})`)
})

// ── 3. buildPublicId ──────────────────────────────────────────────────────────

suite('buildPublicId()', () => {
  eq(buildPublicId('FLS', '2A9KX8'), 'FLS-2A9KX8', 'formato FLS-2A9KX8')
  eq(buildPublicId('SUP', 'ABCDEF'), 'SUP-ABCDEF', 'formato SUP-ABCDEF')
  const code = 'ABCDEF'
  eq(buildPublicId(PREFIX.ACCOUNT,      code), `FLS-${code}`, 'PREFIX.ACCOUNT → FLS-')
  eq(buildPublicId(PREFIX.USER,         code), `USR-${code}`, 'PREFIX.USER → USR-')
  eq(buildPublicId(PREFIX.TICKET,       code), `SUP-${code}`, 'PREFIX.TICKET → SUP-')
  eq(buildPublicId(PREFIX.WORKSPACE,    code), `WKS-${code}`, 'PREFIX.WORKSPACE → WKS-')
  eq(buildPublicId(PREFIX.ORGANIZATION, code), `ORG-${code}`, 'PREFIX.ORGANIZATION → ORG-')
  eq(buildPublicId(PREFIX.INVITE,       code), `INV-${code}`, 'PREFIX.INVITE → INV-')
})

// ── 4. isValidPublicId ────────────────────────────────────────────────────────

suite('isValidPublicId()', () => {
  ok(isValidPublicId('FLS-2A9KX8'),  'aceita FLS-2A9KX8')
  ok(isValidPublicId('SUP-ABCDEF'),  'aceita SUP-ABCDEF')
  ok(isValidPublicId('WKS-M7X9PA'),  'aceita WKS-M7X9PA')
  ok(isValidPublicId('INV-R8K2PM'),  'aceita INV-R8K2PM')
  ok(isValidPublicId('FLS-ABCD'),    'aceita comprimento 4')
  ok(isValidPublicId('FLS-ABCDEF'),  'aceita comprimento 6')
  ok(isValidPublicId('FLS-ABCDEFGH'), 'aceita comprimento 8')

  ok(!isValidPublicId('FLS-0ABCDE'), 'rejeita char proibido 0')
  ok(!isValidPublicId('FLS-OABCDE'), 'rejeita char proibido O')
  ok(!isValidPublicId('FLS-IABCDE'), 'rejeita char proibido I')
  ok(!isValidPublicId('FLS-1ABCDE'), 'rejeita char proibido 1')
  ok(!isValidPublicId('FLS-LABCDE'), 'rejeita char proibido L')
  ok(!isValidPublicId('FLS2A9KX8'),  'rejeita sem hífen')
  ok(!isValidPublicId('FL-2A9KX8'),  'rejeita prefixo com 2 chars')
  ok(!isValidPublicId(''),           'rejeita string vazia')
  ok(!isValidPublicId('fls-2a9kx8'), 'rejeita lowercase')
})

// ── 5. extractPrefix ──────────────────────────────────────────────────────────

suite('extractPrefix()', () => {
  eq(extractPrefix('FLS-2A9KX8'), 'FLS', 'extrai FLS')
  eq(extractPrefix('SUP-ABCDEF'), 'SUP', 'extrai SUP')
  eq(extractPrefix('INV-R8K2PM'), 'INV', 'extrai INV')
})

// ── 6. Unicidade em memória ───────────────────────────────────────────────────

suite('unicidade de _randomCode', () => {
  const seen = new Set<string>()
  let hasDup = false
  for (let i = 0; i < 1000; i++) {
    const code = IdGeneratorService._randomCode(6)
    if (seen.has(code)) { hasDup = true; break }
    seen.add(code)
  }
  ok(!hasDup, '1000 códigos de comprimento 6 sem duplicatas')
})

// ── 7. Prefixos exportados ────────────────────────────────────────────────────

suite('PREFIX constants', () => {
  eq(PREFIX.ACCOUNT,      'FLS', 'ACCOUNT = FLS')
  eq(PREFIX.USER,         'USR', 'USER = USR')
  eq(PREFIX.TICKET,       'SUP', 'TICKET = SUP')
  eq(PREFIX.WORKSPACE,    'WKS', 'WORKSPACE = WKS')
  eq(PREFIX.ORGANIZATION, 'ORG', 'ORGANIZATION = ORG')
  eq(PREFIX.INVITE,       'INV', 'INVITE = INV')
})

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`)
console.log(`Resultado: ${passed} passou, ${failed} falhou`)
if (failed > 0) process.exit(1)
