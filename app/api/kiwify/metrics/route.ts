import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user has Kiwify integration
    const integration = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'KIWIFY', isActive: true },
    })

    if (!integration) return NextResponse.json(null)

    // Aggregate from FunnelEvents this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
      include: {
        events: {
          where: {
            eventType: { contains: 'kiwify' },
            timestamp: { gte: startOfMonth },
          },
        },
      },
    })

    const events = funnel?.events || []

    // Separate paid vs checkout events
    const paidEvents = events.filter(e =>
      e.eventType === 'kiwify_purchase_complete' || e.eventType.includes('paid') || e.eventType.includes('approved')
    )

    // Aggregate revenue
    let totalRevenue = 0
    let totalSales = paidEvents.length

    for (const event of paidEvents) {
      try {
        const meta = JSON.parse(event.metadata || '{}')
        totalRevenue += meta.amount || 0
      } catch {}
    }

    // Count checkouts (all kiwify events including pending)
    const checkouts = events.length
    const taxaConversao = checkouts > 0 ? ((totalSales / checkouts) * 100).toFixed(1) : '0'
    const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0

    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return NextResponse.json({
      pagamentosConfirmados: totalSales,
      checkoutsIniciados: checkouts,
      faturamento: fmt(totalRevenue),
      ticketMedio: fmt(ticketMedio),
      taxaConversaoCheckout: `${taxaConversao}%`,
      raw: { totalSales, totalRevenue, checkouts, ticketMedio },
    })
  } catch (error) {
    console.error('Erro nas métricas Kiwify:', error)
    return NextResponse.json(null)
  }
}
