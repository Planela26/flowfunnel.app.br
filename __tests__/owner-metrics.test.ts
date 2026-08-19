/**
 * Aritmética do laboratório — funções puras, sem banco nem rede.
 * Roda com: npx tsx __tests__/owner-metrics.test.ts
 *
 * Estes números decidem investimento em anúncio. Um ROAS errado por fator de
 * 10 leva alguém a triplicar orçamento numa campanha que perde dinheiro.
 */
import { calcularCusto, compararIndicador, projetar, encontrarGargalo, calcularDivergencia } from '../lib/owner-metrics'

let ok = 0, bad = 0
function checa(n: string, c: boolean, d?: string) {
  if (c) { ok++; console.log('  PASS  ' + n) }
  else { bad++; console.log('  FALHA ' + n + (d ? '\n        ' + d : '')) }
}
const secao = (t: string) => console.log(`\n── ${t}`)

secao('Custo e retorno')
{
  const m = calcularCusto({ investimento: 500, receita: 1200, vendas: 12, checkouts: 40 })
  checa('CAC = investimento ÷ vendas', m.cac.includes('41,67'), `cac=${m.cac}`)
  checa('CPA = investimento ÷ checkouts', m.cpa.includes('12,50'), `cpa=${m.cpa}`)
  checa('ROAS em múltiplo', m.roas === '2.40x', `roas=${m.roas}`)
  checa('ROI percentual', m.roi === '140.0%', `roi=${m.roi}`)
  checa('lucro = receita − investimento', m.lucro.includes('700'), `lucro=${m.lucro}`)
}
{
  const m = calcularCusto({ investimento: null, receita: 1200, vendas: 12, checkouts: 40 })
  checa('sem conta conectada NÃO inventa zero', m.roas === '—' && m.roi === '—' && m.cac === '—',
    `roas=${m.roas} roi=${m.roi} cac=${m.cac}`)
}
{
  const m = calcularCusto({ investimento: 500, receita: 200, vendas: 2, checkouts: 10 })
  checa('prejuízo aparece como ROI negativo', m.roi.startsWith('-'), `roi=${m.roi}`)
  checa('e ROAS abaixo de 1x', parseFloat(m.roas) < 1, `roas=${m.roas}`)
}
{
  const m = calcularCusto({ investimento: 500, receita: 0, vendas: 0, checkouts: 0 })
  checa('investiu e não vendeu: CAC indefinido, não zero', m.cac === '—', `cac=${m.cac}`)
}

secao('Comparação entre períodos')
{
  const v = compararIndicador(120, 100, true)
  checa('crescimento de 20%', v.variacao === '+20.0%' && v.direcao === 'sobe', `${v.variacao}/${v.direcao}`)
  checa('subir receita = melhorou', v.melhorou === true)
}
{
  const v = compararIndicador(80, 100, true)
  checa('queda de 20%', v.variacao === '-20.0%' && v.direcao === 'desce', `${v.variacao}`)
  checa('cair receita = piorou', v.melhorou === false)
}
{
  const v = compararIndicador(60, 40, false) // CAC subiu
  checa('CAC subindo é PIORA, não melhora', v.melhorou === false, `melhorou=${v.melhorou}`)
}
{
  const v = compararIndicador(30, 40, false) // CAC caiu
  checa('CAC caindo é melhora', v.melhorou === true, `melhorou=${v.melhorou}`)
}
{
  const v = compararIndicador(10, 0, true)
  checa('sair do zero não vira porcentagem infinita', v.variacao === 'novo', `variacao=${v.variacao}`)
}
{
  const v = compararIndicador(100, 100, true)
  checa('sem mudança = estável', v.direcao === 'estavel' && v.melhorou === null, `${v.direcao}`)
}

secao('Projeção')
{
  const p = projetar({
    investimentoNoPeriodo: 1000, receitaNoPeriodo: 2400, vendasNoPeriodo: 24,
    diasDoPeriodo: 30, investimentoDiarioPretendido: 50, diasProjetados: 30,
  })
  checa('projeta com base suficiente', p.possivel === true)
  // 24 vendas / R$1000 = 0,024 venda por real. R$50 × 30 dias = R$1500.
  // 0,024 × 1500 = 36 vendas. Ticket 100 → R$3.600.
  checa('vendas projetadas corretas', p.vendasProjetadas === 36, `vendas=${p.vendasProjetadas}`)
  checa('receita projetada correta', p.receitaProjetada === 3600, `receita=${p.receitaProjetada}`)
  checa('confiança média com 24 vendas', p.confianca === 'media', `confianca=${p.confianca}`)
}
{
  const p = projetar({
    investimentoNoPeriodo: 1000, receitaNoPeriodo: 300, vendasNoPeriodo: 3,
    diasDoPeriodo: 30, investimentoDiarioPretendido: 50, diasProjetados: 30,
  })
  checa('recusa projetar com 3 vendas', p.possivel === false, `possivel=${p.possivel}`)
  checa('e explica o motivo', !!p.motivo?.includes('Poucas vendas'), `motivo=${p.motivo}`)
}
{
  const p = projetar({
    investimentoNoPeriodo: null, receitaNoPeriodo: 5000, vendasNoPeriodo: 50,
    diasDoPeriodo: 30, investimentoDiarioPretendido: 50, diasProjetados: 30,
  })
  checa('sem custo conectado, não projeta', p.possivel === false)
  checa('e pede para conectar a conta', !!p.motivo?.includes('conta de anúncios'), `motivo=${p.motivo}`)
}
{
  const p = projetar({
    investimentoNoPeriodo: 2000, receitaNoPeriodo: 6000, vendasNoPeriodo: 60,
    diasDoPeriodo: 30, investimentoDiarioPretendido: 100, diasProjetados: 30,
  })
  checa('confiança alta com 60 vendas em 30 dias', p.confianca === 'alta', `confianca=${p.confianca}`)
}

secao('Gargalo')
{
  const g = encontrarGargalo([
    { rotulo: 'Visitas', total: 1000 },
    { rotulo: 'Engajamento', total: 700 },
    { rotulo: 'CTA', total: 250 },
    { rotulo: 'Checkout', total: 100 },
    { rotulo: 'Compras', total: 40 },
  ])
  // Engajamento→CTA = 35,7% é a menor passagem da cadeia.
  checa('acha a menor TAXA de passagem', g?.de === 'Engajamento' && g?.para === 'CTA', `${g?.de}→${g?.para}`)
  checa('reporta quantos se perderam', g?.perdidos === 450, `perdidos=${g?.perdidos}`)
}
{
  const g = encontrarGargalo([
    { rotulo: 'Visitas', total: 1000 },
    { rotulo: 'Engajamento', total: 500 },   // perde 500 (50%)
    { rotulo: 'CTA', total: 60 },            // perde 440 (12%) ← pior TAXA
  ])
  checa('volume grande não engana: vale a taxa', g?.de === 'Engajamento', `gargalo=${g?.de}→${g?.para}`)
}
{
  const g = encontrarGargalo([{ rotulo: 'Visitas', total: 0 }, { rotulo: 'CTA', total: 0 }])
  checa('funil vazio não quebra', g === null, `g=${JSON.stringify(g)}`)
}

secao('Divergência entre o clique pago e a visita registrada')
{
  const d = calcularDivergencia(1000, 820)
  checa('captura em porcentagem', d?.captura === 82, `captura=${d?.captura}`)
  checa('conta quantos cliques não viraram visita', d?.naoChegaram === 180, `naoChegaram=${d?.naoChegaram}`)
}
{
  const d = calcularDivergencia(0, 0)
  checa('sem cliques no período devolve null, não 0%', d === null, `d=${JSON.stringify(d)}`)
}
{
  const d = calcularDivergencia(null, 500)
  checa('conta de anúncios desconectada devolve null', d === null)
}
{
  // Tráfego direto/orgânico marcado como Meta pode passar do clique pago.
  const d = calcularDivergencia(100, 130)
  checa('registrado acima do clique não vira perda negativa', d?.naoChegaram === 0, `naoChegaram=${d?.naoChegaram}`)
  checa('e a captura passa de 100 em vez de ser truncada', (d?.captura ?? 0) > 100, `captura=${d?.captura}`)
}
{
  const d = calcularDivergencia(500, 0)
  checa('pagou e ninguém chegou: captura zero, perda total', d?.captura === 0 && d?.naoChegaram === 500,
    `captura=${d?.captura} naoChegaram=${d?.naoChegaram}`)
}

console.log(`\n${'='.repeat(58)}`)
console.log(`  ${ok} passaram, ${bad} falharam`)
console.log('='.repeat(58))
process.exit(bad ? 1 : 0)
