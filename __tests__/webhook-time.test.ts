/**
 * Normalização de data de webhook — função PURA (sem DB/rede).
 *
 * O defeito que originou isto: a Hotmart 2.0.0 manda `approved_date` em
 * milissegundos e o código multiplicava por 1000, gravando a venda no ano
 * ~50.000. Consultas do tipo `timestamp >= X` continuavam casando, então o card
 * "funcionava" e os gráficos não.
 *
 * Roda com: npx tsx __tests__/webhook-time.test.ts
 */
import { dataDeWebhook } from '../lib/webhook-time'

let pass = 0, fail = 0
const failures: string[] = []
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; failures.push(name); console.error('  ✗', name) }
}

const AGORA = new Date('2026-08-22T03:00:00.000Z')
const ano = (d: Date) => d.getUTCFullYear()

console.log('\ndataDeWebhook')

// A unidade real da Hotmart 2.0.0.
const ms = 1755831600000 // 2025-08-22
ok('milissegundos são usados como estão', dataDeWebhook(ms, AGORA).getTime() === ms)
ok('milissegundos caem no ano certo', ano(dataDeWebhook(ms, AGORA)) === 2025)

// A unidade que o código antigo assumia — precisa continuar funcionando para
// qualquer plataforma que realmente mande segundos.
const s = 1755831600 // mesmo instante, em segundos
ok('segundos são multiplicados', dataDeWebhook(s, AGORA).getTime() === ms)
ok('segundos e milissegundos do mesmo instante convergem',
  dataDeWebhook(s, AGORA).getTime() === dataDeWebhook(ms, AGORA).getTime())

// O defeito exato: ms tratado como segundos.
ok('o bug antigo daria ano > 2100', new Date(ms * 1000).getUTCFullYear() > 2100)

// Strings numéricas (algumas plataformas mandam o timestamp como string).
ok('string numérica em ms', dataDeWebhook(String(ms), AGORA).getTime() === ms)
ok('string numérica em s', dataDeWebhook(String(s), AGORA).getTime() === ms)

// ISO 8601.
ok('ISO 8601 é aceito', dataDeWebhook('2025-08-22T03:00:00.000Z', AGORA).getUTCFullYear() === 2025)

// Entradas que não dá para aproveitar caem em `agora`, nunca em lixo.
for (const [rotulo, v] of [
  ['null', null], ['undefined', undefined], ['string vazia', ''],
  ['texto', 'ontem'], ['zero', 0], ['negativo', -5], ['NaN', NaN],
] as [string, unknown][]) {
  ok(`${rotulo} vira agora`, dataDeWebhook(v, AGORA).getTime() === AGORA.getTime())
}

// Date entra e sai igual; Date inválido vira agora.
const d = new Date('2025-01-02T03:04:05.000Z')
ok('Date válido passa direto', dataDeWebhook(d, AGORA).getTime() === d.getTime())
ok('Date inválido vira agora', dataDeWebhook(new Date('xx'), AGORA).getTime() === AGORA.getTime())

// Guarda de plausibilidade nas duas pontas.
ok('ano 1970 é recusado', dataDeWebhook(1, AGORA).getTime() === AGORA.getTime())
ok('ano distante é recusado', dataDeWebhook(999999999999999, AGORA).getTime() === AGORA.getTime())

console.log(`\n${pass} passaram, ${fail} falharam`)
if (fail) { console.error('falhas:', failures.join(', ')); process.exit(1) }
