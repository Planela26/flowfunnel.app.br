import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
    })

    if (!funnel) {
      return NextResponse.json({
        checkoutsIniciados: 0,
        checkoutsNaoTerminados: 0,
        pagamentosConfirmados: 0,
        taxaConversaoCheckout: '0%',
        ticketMedio: 'R$ 0',
        faturamento: 'R$ 0',
        connected: false,
      })
    }

    const events = await prisma.funnelEvent.findMany({
      where: {
        funnelId: funnel.id,
        eventType: { contains: 'eduzz' },
        timestamp: { gte: last30Days },
      },
    })

    const paidEvents = events.filter((e: any) => {
      const m = typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : e.metadata || {}
      return e.eventType.includes('paid') || e.eventType.includes('approved') || e.eventType.includes('complete') || m.status === 'paid' || m.status === 'approved'
    })

    const abandonedEvents = events.filter((e: any) => {
      const m = typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : e.metadata || {}
      return e.eventType.includes('abandon') || m.status === 'abandoned' || m.status === 'refused'
    })

    const totalSales = paidEvents.length
    let totalRevenue = 0
    for (const e of paidEvents) {
      const m = typeof e.metadata === 'string' ? JSON.parse(e.metadata || '{}') : e.metadata || {}
      totalRevenue += parseFloat(m.price || m.amount || m.value || 0)
    }

    const checkoutsIniciados = totalSales + abandonedEvents.length
    const checkoutsNaoTerminados = Math.max(0, checkoutsIniciados - totalSales)
    const taxaConversao = checkoutsIniciados > 0 ? (totalSales / checkoutsIniciados) * 100 : 0
    const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

    return NextResponse.json({
      checkoutsIniciados,
      checkoutsNaoTerminados,
      pagamentosConfirmados: totalSales,
      taxaConversaoCheckout: `${taxaConversao.toFixed(1)}%`,
      ticketMedio: fmt(ticketMedio),
      faturamento: fmt(totalRevenue),
      connected: true,
      raw: { totalSales, totalRevenue, averageTicket: ticketMedio },
      data: { sales: totalSales, revenue: totalRevenue, checkouts: checkoutsIniciados, conversionRate: taxaConversao },
    })
  } catch (error) {
    console.error('Erro ao buscar métricas Eduzz:', error)
    return NextResponse.json({ error: 'Erro ao buscar métricas' }, { status: 500 })
  }
}
