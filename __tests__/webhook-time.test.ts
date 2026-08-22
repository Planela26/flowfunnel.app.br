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
import { dataDeWebhook, valorDaCompra } from '../lib/webhook-time'

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

console.log('\nvalorDaCompra')

// O caminho normal: price preenchido.
const p1 = valorDaCompra({ price: { value: 97.9, currency_value: 'BRL' } })
ok('usa price quando existe', p1.valor === 97.9 && p1.campo === 'price')
ok('traz a moeda junto', p1.moeda === 'BRL')

// O defeito: lia SÓ price e gravava 0 quando ele não vinha.
const p2 = valorDaCompra({ full_price: { value: 120.5, currency_value: 'BRL' } })
ok('cai para full_price', p2.valor === 120.5 && p2.campo === 'full_price')

const p3 = valorDaCompra({ original_offer_price: { value: 47, currency_value: 'BRL' } })
ok('cai para original_offer_price', p3.valor === 47 && p3.campo === 'original_offer_price')

// Precedência: price ganha de full_price (juros de parcelamento não são o
// valor da venda).
const p4 = valorDaCompra({ price: { value: 97.9 }, full_price: { value: 120.5 } })
ok('price tem precedência sobre full_price', p4.valor === 97.9 && p4.campo === 'price')

// Zero não é valor válido — segue procurando.
const p5 = valorDaCompra({ price: { value: 0 }, full_price: { value: 88 } })
ok('price zerado não bloqueia o fallback', p5.valor === 88 && p5.campo === 'full_price')

// Nada aproveitável: devolve 0 e diz que não achou campo nenhum.
for (const [rotulo, v] of [
  ['objeto vazio', {}], ['null', null], ['undefined', undefined],
  ['todos zerados', { price: { value: 0 }, full_price: { value: 0 }, original_offer_price: { value: 0 } }],
  ['valor não numérico', { price: { value: 'grátis' } }],
  ['negativo', { price: { value: -10 } }],
] as [string, unknown][]) {
  const r = valorDaCompra(v)
  ok(`${rotulo} → 0 e campo null`, r.valor === 0 && r.campo === null)
}

// String numérica (algumas plataformas mandam assim).
ok('string numérica é aceita', valorDaCompra({ price: { value: '59.90' } }).valor === 59.9)

console.log(`\n${pass} passaram, ${fail} falharam`)
if (fail) { console.error('falhas:', failures.join(', ')); process.exit(1) }
