import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireFeature } from '@/lib/withPlan'
import { isSaleEvent, isCanceledSale, extractAmount, saleTransactionId } from '@/lib/sale-events'

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  let start = new Date(now)

  switch (period) {
    case '7d':
      start.setDate(now.getDate() - 7)
      break
    case '30d':
      start.setDate(now.getDate() - 30)
      break
    case '90d':
      start.setDate(now.getDate() - 90)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'lastmonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end.setTime(new Date(now.getFullYear(), now.getMonth(), 0).getTime())
      break
    default:
      start.setDate(now.getDate() - 30)
  }
  return { start, end }
}

async function getMetrics(userId: string, start: Date, end: Date) {
  const funnel = await prisma.funnel.findFirst({
    where: { userId },
    include: {
      events: {
        where: { timestamp: { gte: start, lte: end } },
      },
    },
  })

  const events = funnel?.events || []

  // Detecção de venda unificada (mesma lógica de timeseries/reports/snapshot):
  // ignora vendas canceladas e deduplica por id de transação.
  const seenSaleTx = new Set<string>()
  let vendas = 0
  let totalRevenue = 0
  for (const e of events) {
    if (!isSaleEvent(e.eventType)) continue
    let meta: any = {}
    try { meta = JSON.parse(e.metadata || '{}') } catch {}
    if (isCanceledSale(meta)) continue
    const tx = saleTransactionId(meta)
    if (tx) {
      if (seenSaleTx.has(tx)) continue
      seenSaleTx.add(tx)
    }
    vendas += 1
    totalRevenue += extractAmount(meta)
  }

  // WhatsApp conversations
  const waLogs = await prisma.webhookLog.count({
    where: {
      userId,
      platform: 'WHATSAPP',
      event: 'message',
      createdAt: { gte: start, lte: end },
    },
  })

  const conversao = vendas > 0 && waLogs > 0
    ? parseFloat(((vendas / waLogs) * 100).toFixed(1))
    : 0

  return {
    vendas,
    faturamento: totalRevenue,
    leads: waLogs,
    conversao,
  }
}

export async function GET(request: Request) {
  try {
    const guard = await requireFeature('period_comparison')
    if (guard.response) return guard.response
    const { user } = guard

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    const { start: currentStart, end: currentEnd } = getPeriodDates(period)
    const duration = currentEnd.getTime() - currentStart.getTime()
    const previousEnd = new Date(currentStart)
    const previousStart = new Date(currentStart.getTime() - duration)

    const [current, previous] = await Promise.all([
      getMetrics(user.id, currentStart, currentEnd),
      getMetrics(user.id, previousStart, previousEnd),
    ])

    return NextResponse.json({ current, previous, period })
  } catch (error) {
    console.error('Erro na comparação de períodos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
