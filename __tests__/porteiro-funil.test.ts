/**
 * O porteiro — a regra que decide de qual funil é cada venda.
 *
 * O defeito que originou isto: a pergunta "de qual funil é este dado?" era
 * refeita a cada LEITURA, por cada tela, e as que esqueciam de perguntar
 * mostravam a conta inteira — dois funis, os mesmos números nos dois.
 *
 * Aqui só a REGRA é testada (função pura, sem banco): o mapa `id do produto →
 * funil`, que é o que leva a venda ao lugar certo na chegada.
 *
 * Roda com: npx tsx __tests__/porteiro-funil.test.ts
 */
import { montarMapaDeProdutos, normalizarIdProduto } from '../lib/porteiro-funil'

let pass = 0, fail = 0
const failures: string[] = []
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; failures.push(name); console.error('  ✗', name) }
}

const funil = (id: string, vinculo: Record<string, string[]> | null) => ({
  id,
  checkoutProductIds: vinculo ? JSON.stringify(vinculo) : null,
})

console.log('\nnormalizarIdProduto')

// A Hotmart manda número no webhook; o vínculo guarda o que foi digitado.
// Sem normalizar os dois lados, a venda caía em "Sem funil" sem motivo visível.
ok('número vira texto', normalizarIdProduto(8365536) === '8365536')
ok('espaço sobrando é aparado', normalizarIdProduto('  8365536 ') === '8365536')
ok('vazio é ausência', normalizarIdProduto('   ') === null)
ok('nulo é ausência', normalizarIdProduto(null) === null)
ok('indefinido é ausência', normalizarIdProduto(undefined) === null)
// Zero é um id improvável, mas descartá-lo por ser "falso" seria um bug calado.
ok('zero não é tratado como ausência', normalizarIdProduto(0) === '0')

console.log('\nmontarMapaDeProdutos')

const dois = [
  funil('wks_A', { hotmart: ['111', '222'] }),
  funil('wks_B', { hotmart: ['333'] }),
]
const mapa = montarMapaDeProdutos(dois, 'hotmart')

ok('produto do funil A aponta para A', mapa.get('111') === 'wks_A')
ok('segundo produto do funil A também aponta para A', mapa.get('222') === 'wks_A')
ok('produto do funil B aponta para B', mapa.get('333') === 'wks_B')
// O caso que o usuário vive: produto que ninguém cadastrou. Não é erro —
// é o "Sem funil", que aparece na tela de propósito.
ok('produto não vinculado não tem dono', mapa.get('999') === undefined)

// Cada plataforma tem seu espaço de ids. Um id da Kiwify igual a um da Hotmart
// não pode levar a venda para o funil errado.
const misto = [funil('wks_A', { hotmart: ['111'], kiwify: ['111'] })]
ok('plataformas não se misturam',
  montarMapaDeProdutos(misto, 'kiwify').get('111') === 'wks_A' &&
  montarMapaDeProdutos(misto, 'eduzz').size === 0)

// A validação do cadastro impede id repetido, mas dado antigo pode ter — e
// nesse caso a venda precisa ir para ALGUM lugar, de forma previsível.
const repetido = [
  funil('wks_primeiro', { hotmart: ['111'] }),
  funil('wks_segundo', { hotmart: ['111'] }),
]
ok('id repetido fica com o primeiro funil',
  montarMapaDeProdutos(repetido, 'hotmart').get('111') === 'wks_primeiro')

// Vínculo ilegível não pode derrubar a ingestão nem contaminar os outros.
const quebrado = [
  { id: 'wks_quebrado', checkoutProductIds: '{isso não é json' },
  funil('wks_ok', { hotmart: ['222'] }),
]
ok('vínculo ilegível é ignorado sem derrubar o resto',
  montarMapaDeProdutos(quebrado, 'hotmart').get('222') === 'wks_ok')

// Funil sem vínculo não reivindica nada. É o que faz o card dele dizer
// "aguardando integrações" em vez de mostrar as vendas dos outros.
ok('funil sem vínculo não reivindica nada',
  montarMapaDeProdutos([funil('wks_vazio', null)], 'hotmart').size === 0)
ok('lista vazia de produtos não reivindica nada',
  montarMapaDeProdutos([funil('wks_vazio', { hotmart: [] })], 'hotmart').size === 0)

// O id digitado com espaço precisa casar com o número que o webhook manda.
const comEspaco = [funil('wks_A', { hotmart: [' 8365536 '] })]
ok('id cadastrado com espaço casa com o id do webhook',
  montarMapaDeProdutos(comEspaco, 'hotmart').get(normalizarIdProduto(8365536)!) === 'wks_A')

console.log(`\n${pass} passaram, ${fail} falharam`)
if (fail > 0) {
  console.error('\nFalhas:', failures.join(', '))
  process.exit(1)
}
