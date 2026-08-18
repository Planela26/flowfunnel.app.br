/**
 * Métricas derivadas do laboratório: custo, retorno, comparação e projeção.
 *
 * Funções PURAS de propósito — recebem números e devolvem números. O que vem
 * do banco (funil) e o que vem da Meta (custo) é resolvido nas rotas; aqui só
 * mora a aritmética, que é o que precisa ser conferido com cuidado quando
 * envolve dinheiro.
 *
 * Regra geral: sem dado de custo, o resultado é `null`, nunca zero. Zero seria
 * lido como "gastei nada e vendi", que é uma mentira confortável — e decisões
 * de investimento não podem ser tomadas em cima disso.
 */

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export type MetricasDeCusto = {
  investimento: number | null
  investimentoFormatado: string
  cac: string        // custo de aquisição por cliente
  cpa: string        // custo por ação (checkout iniciado)
  roas: string       // receita ÷ investimento
  roi: string        // retorno percentual sobre o investido
  lucro: string
}

/**
 * CAC, CPA, ROAS e ROI.
 *
 * `investimento` nulo significa conta de anúncios não conectada. Nesse caso
 * TUDO volta como "—": sem saber o custo, nenhuma dessas quatro tem
 * significado, e exibir "ROAS 0" ou "ROI -100%" induziria a erro.
 */
export function calcularCusto(params: {
  investimento: number | null
  receita: number
  vendas: number
  checkouts: number
}): MetricasDeCusto {
  const { investimento, receita, vendas, checkouts } = params

  if (investimento === null || investimento <= 0) {
    return {
      investimento,
      investimentoFormatado: investimento === null ? '—' : brl(0),
      cac: '—', cpa: '—', roas: '—', roi: '—', lucro: '—',
    }
  }

  const lucro = receita - investimento

  return {
    investimento,
    investimentoFormatado: brl(investimento),
    cac: vendas > 0 ? brl(investimento / vendas) : '—',
    cpa: checkouts > 0 ? brl(investimento / checkouts) : '—',
    // ROAS em múltiplo ("2,4x") e não em porcentagem: é como o mercado lê.
    roas: `${(receita / investimento).toFixed(2)}x`,
    roi: `${(((receita - investimento) / investimento) * 100).toFixed(1)}%`,
    lucro: brl(lucro),
  }
}

export type Variacao = {
  atual: number
  anterior: number
  variacao: string          // "+18,2%" | "-7,0%" | "—"
  direcao: 'sobe' | 'desce' | 'estavel'
  /** Se subir é bom. Custo que sobe é ruim; receita que sobe é boa. */
  melhorou: boolean | null
}

/**
 * Compara um indicador entre dois períodos.
 *
 * `maiorEhMelhor` existe porque a mesma seta significa coisas opostas: CAC
 * subindo é problema, receita subindo é resultado. Sem esse parâmetro a tela
 * pintaria de verde um custo que dobrou.
 */
export function compararIndicador(
  atual: number,
  anterior: number,
  maiorEhMelhor = true,
): Variacao {
  if (anterior === 0) {
    return {
      atual, anterior,
      // Sair de zero é infinito percentual — inútil como número, então
      // reportamos a direção sem inventar uma taxa.
      variacao: atual > 0 ? 'novo' : '—',
      direcao: atual > 0 ? 'sobe' : 'estavel',
      melhorou: atual > 0 ? maiorEhMelhor : null,
    }
  }

  const delta = ((atual - anterior) / anterior) * 100
  const direcao = Math.abs(delta) < 0.05 ? 'estavel' : delta > 0 ? 'sobe' : 'desce'

  return {
    atual, anterior,
    variacao: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
    direcao,
    melhorou: direcao === 'estavel' ? null : (direcao === 'sobe') === maiorEhMelhor,
  }
}

export type Projecao = {
  possivel: boolean
  motivo?: string
  investimentoDiario?: number
  vendasProjetadas?: number
  receitaProjetada?: number
  receitaProjetadaFormatada?: string
  confianca?: 'baixa' | 'media' | 'alta'
}

/**
 * Projeção simples de vendas e receita para N dias.
 *
 * Deliberadamente linear: extrapola a taxa observada sobre o investimento
 * pretendido. Não modela sazonalidade, saturação de público nem fadiga de
 * criativo — e é exatamente por isso que a confiança é reportada junto e o
 * texto na tela diz que é estimativa.
 *
 * Abaixo de 10 vendas no período a projeção não é publicada. Com 3 vendas, uma
 * a mais ou a menos move o resultado em 33%, e um número desses passa uma
 * segurança que o dado não sustenta.
 */
const MINIMO_DE_VENDAS = 10

export function projetar(params: {
  investimentoNoPeriodo: number | null
  receitaNoPeriodo: number
  vendasNoPeriodo: number
  diasDoPeriodo: number
  investimentoDiarioPretendido: number
  diasProjetados: number
}): Projecao {
  const {
    investimentoNoPeriodo, receitaNoPeriodo, vendasNoPeriodo,
    diasDoPeriodo, investimentoDiarioPretendido, diasProjetados,
  } = params

  if (investimentoNoPeriodo === null || investimentoNoPeriodo <= 0) {
    return { possivel: false, motivo: 'Conecte a conta de anúncios para projetar com base no investimento.' }
  }
  if (vendasNoPeriodo < MINIMO_DE_VENDAS) {
    return {
      possivel: false,
      motivo: `Poucas vendas no período (${vendasNoPeriodo}). A partir de ${MINIMO_DE_VENDAS} a projeção passa a ter significado.`,
    }
  }
  if (investimentoDiarioPretendido <= 0 || diasProjetados <= 0) {
    return { possivel: false, motivo: 'Informe o investimento diário e o período desejado.' }
  }

  const vendasPorReal = vendasNoPeriodo / investimentoNoPeriodo
  const ticket = receitaNoPeriodo / vendasNoPeriodo
  const investimentoTotal = investimentoDiarioPretendido * diasProjetados

  const vendasProjetadas = vendasPorReal * investimentoTotal
  const receitaProjetada = vendasProjetadas * ticket

  // Mais dias observados e mais vendas = base mais firme. Um período de 30
  // dias com 50 vendas sustenta bem mais do que 7 dias com 11.
  const confianca: Projecao['confianca'] =
    vendasNoPeriodo >= 30 && diasDoPeriodo >= 14 ? 'alta'
    : vendasNoPeriodo >= 15 ? 'media'
    : 'baixa'

  return {
    possivel: true,
    investimentoDiario: investimentoDiarioPretendido,
    vendasProjetadas: Math.round(vendasProjetadas * 10) / 10,
    receitaProjetada,
    receitaProjetadaFormatada: brl(receitaProjetada),
    confianca,
  }
}

/**
 * Maior perda entre degraus consecutivos — o gargalo.
 *
 * Compara a TAXA de passagem, não o volume absoluto. Perder 500 pessoas de
 * 1000 é pior que perder 50 de 60, mesmo o segundo número sendo menor.
 */
export function encontrarGargalo(
  passos: Array<{ rotulo: string; total: number }>,
): { de: string; para: string; taxa: number; perdidos: number } | null {
  let pior: { de: string; para: string; taxa: number; perdidos: number } | null = null

  for (let i = 1; i < passos.length; i++) {
    const anterior = passos[i - 1]
    if (anterior.total === 0) continue
    const taxa = (passos[i].total / anterior.total) * 100
    if (!pior || taxa < pior.taxa) {
      pior = {
        de: anterior.rotulo,
        para: passos[i].rotulo,
        taxa,
        perdidos: anterior.total - passos[i].total,
      }
    }
  }

  return pior
}
