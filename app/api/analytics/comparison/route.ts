import { NextResponse } from 'next/server'
import { requireFeature } from '@/lib/withPlan'
import { comparePeriods } from '@/lib/analytics-comparison'

/**
 * Comparação de períodos (PRO+).
 *
 * O cálculo saiu daqui para `lib/analytics-comparison`, que é a fonte única
 * usada também pela Sara. Antes, esta rota tinha a sua própria conta e três
 * defeitos: contava `webhookLog` de WhatsApp e chamava de `leads` (são
 * mensagens, não pessoas), derivava a conversão de `vendas / mensagens` — que
 * piorava quanto mais o time atendia o mesmo lead — e lia apenas o PRIMEIRO
 * funil via `findFirst`, ignorando em silêncio os demais funis do PRO e do SCALE.
 */

function getPeriodDates(period: string): { start: Date; end: Date; label: string } {
  const now = new Date()
  const end = new Date(now)
  let start = new Date(now)
  let label = 'últimos 30 dias'

  switch (period) {
    case '7d':
      start.setDate(now.getDate() - 7)
      label = 'últimos 7 dias'
      break
    case '30d':
      start.setDate(now.getDate() - 30)
      label = 'últimos 30 dias'
      break
    case '90d':
      start.setDate(now.getDate() - 90)
      label = 'últimos 90 dias'
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      label = 'este mês'
      break
    case 'lastmonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end.setTime(new Date(now.getFullYear(), now.getMonth(), 0).getTime())
      label = 'mês passado'
      break
    default:
      start.setDate(now.getDate() - 30)
  }
  return { start, end, label }
}

export async function GET(request: Request) {
  try {
    const guard = await requireFeature('period_comparison')
    if (guard.response) return guard.response
    const { user } = guard

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    const { start, end, label } = getPeriodDates(period)
    const result = await comparePeriods(user.id, start, end, { current: label })

    // `current`/`previous` mantêm as chaves que o dashboard já lê
    // (`faturamento`, `leads`, `conversao`), agora com o significado correto:
    // `leads` são leads de verdade, e não mais a contagem de mensagens.
    // `comparison` traz a estrutura completa (variações, anomalias, ressalvas).
    const legacy = (m: typeof result.current) => ({
      vendas: m.vendas,
      faturamento: m.receita,
      leads: m.leads,
      conversao: m.taxaConversao ?? 0,
      conversas: m.conversas,
      mensagensWhatsapp: m.mensagensWhatsapp,
      checkouts: m.checkouts,
      gasto: m.gasto,
      ticketMedio: m.ticketMedio,
      custoPorLead: m.custoPorLead,
    })

    return NextResponse.json({
      current: legacy(result.current),
      previous: legacy(result.previous),
      period,
      comparison: result,
    })
  } catch (error) {
    console.error('Erro na comparação de períodos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
