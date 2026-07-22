import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'

// Buscar métricas do Hotmart para o dashboard
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar cache
    const cacheKey = generateCacheKey(session.user.id, 'hotmart-metrics')
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Buscar integração Hotmart
    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'HOTMART',
        isActive: true,
      },
    })

    if (!integration) {
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

    // Buscar funil do usuário
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
        connected: true,
      })
    }

    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Contar checkouts iniciados (últimos 30 dias)
    const checkoutsIniciados = await prisma.funnelEvent.count({
      where: {
        funnelId: funnel.id,
        eventType: 'hotmart_checkout_started',
        timestamp: {
          gte: last30Days,
        },
      },
    })

    // Buscar vendas completas
    const vendasCompletas = await prisma.funnelEvent.findMany({
      where: {
        funnelId: funnel.id,
        eventType: 'hotmart_purchase_complete',
        timestamp: {
          gte: last30Days,
        },
      },
    })

    // Filtrar apenas vendas não canceladas
    const vendasAtivas = vendasCompletas.filter((venda: any) => {
      const metadata = typeof venda.metadata === 'string'
        ? JSON.parse(venda.metadata)
        : venda.metadata
      return metadata.status !== 'canceled'
    })

    const pagamentosConfirmados = vendasAtivas.length

    // Calcular faturamento total
    let faturamentoTotal = 0
    vendasAtivas.forEach((venda: any) => {
      const metadata = typeof venda.metadata === 'string'
        ? JSON.parse(venda.metadata)
        : venda.metadata
      faturamentoTotal += parseFloat(metadata.price || 0)
    })

    // Calcular ticket médio
    const ticketMedio = pagamentosConfirmados > 0
      ? faturamentoTotal / pagamentosConfirmados
      : 0

    // Calcular checkouts não terminados
    // (checkouts iniciados - pagamentos confirmados)
    const checkoutsNaoTerminados = Math.max(0, checkoutsIniciados - pagamentosConfirmados)

    // Taxa de conversão de checkout
    const taxaConversao = checkoutsIniciados > 0
      ? (pagamentosConfirmados / checkoutsIniciados) * 100
      : 0

    // Formatar valores
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value)
    }

    const response = {
      checkoutsIniciados,
      checkoutsNaoTerminados,
      pagamentosConfirmados,
      taxaConversaoCheckout: `${taxaConversao.toFixed(1)}%`,
      ticketMedio: formatCurrency(ticketMedio),
      faturamento: formatCurrency(faturamentoTotal),
      connected: true,
      // Dados brutos para cálculos
      raw: {
        totalSales: pagamentosConfirmados,
        totalRevenue: faturamentoTotal,
        averageTicket: ticketMedio,
      },
      data: {
        sales: pagamentosConfirmados,
        revenue: faturamentoTotal,
        checkouts: checkoutsIniciados,
        conversionRate: taxaConversao,
      },
    }

    // Salvar no cache por 2 minutos
    cache.set(cacheKey, response, CacheTTL.MEDIUM)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao buscar métricas Hotmart:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    )
  }
}
