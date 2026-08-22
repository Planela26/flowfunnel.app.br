import { desdeQuando } from '@/lib/periodo'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'
import { isCanceledSale, extractAmount } from '@/lib/sale-events'

// Buscar métricas do Hotmart para o dashboard
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // A chave precisa incluir a janela. Sem isso, "Hoje" e "Últimos 30 dias"
    // compartilhavam a MESMA entrada de cache: trocar o período no dashboard
    // devolvia os números da janela anterior por até dois minutos.
    const dias = new URL(request.url).searchParams.get('days') || '30'
    const cacheKey = generateCacheKey(session.user.id, 'hotmart-metrics', { dias })
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

    // Todos os funis do usuário, não `findFirst`. O gravador usa
    // `ensureFunnelWithStages`, que pega o mais ANTIGO; este `findFirst` não
    // tinha `orderBy` nenhum, então os dois podiam olhar para funis diferentes
    // e o card lia um funil vazio enquanto as vendas estavam no outro.
    const funis = await prisma.funnel.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const funnelIds = funis.map((f) => f.id)

    if (funnelIds.length === 0) {
      return NextResponse.json({
        checkoutsIniciados: 0,
        checkoutsNaoTerminados: 0,
        pagamentosConfirmados: 0,
        taxaConversaoCheckout: '0%',
        ticketMedio: 'R$ 0',
        faturamento: 'R$ 0',
        connected: true,
        // Zero aqui não é medição: é a ausência de qualquer evento já recebido.
        // O card usa isso para dizer "aguardando o primeiro evento" em vez de
        // afirmar que não houve vendas.
        aguardandoPrimeiroEvento: true,
      })
    }

    const desde = desdeQuando(request) // janela escolhida no dashboard; 30 dias por padrão
    const naJanela = { funnelId: { in: funnelIds }, timestamp: { gte: desde } }

    // Boletos/PIX emitidos e ainda não pagos.
    const checkoutsPendentes = await prisma.funnelEvent.count({
      where: { ...naJanela, eventType: 'hotmart_checkout_started' },
    })

    // Carrinhos abandonados — evento PURCHASE_OUT_OF_SHOPPING_CART.
    // Antes, "abandonados" era `checkouts - confirmados`, uma subtração entre
    // grandezas que não se relacionam: dava 0 sempre, e negativo quando havia
    // mais vendas do que boletos.
    const carrinhosAbandonados = await prisma.funnelEvent.count({
      where: { ...naJanela, eventType: 'hotmart_cart_abandoned' },
    })

    // Buscar vendas completas
    const vendasCompletas = await prisma.funnelEvent.findMany({
      where: { ...naJanela, eventType: 'hotmart_purchase_complete' },
    })

    const lerMeta = (venda: any) => {
      try {
        return typeof venda.metadata === 'string' ? JSON.parse(venda.metadata) : venda.metadata
      } catch {
        return {}
      }
    }

    // `isCanceledSale` é a mesma regra usada em Relatórios, Analytics e no cron
    // de snapshot. A daqui testava só `status !== 'canceled'`, então uma venda
    // REEMBOLSADA (status 'refunded') continuava contando como confirmada e
    // somando faturamento — o card mostrava receita que já tinha voltado.
    const vendasAtivas = vendasCompletas.filter((venda: any) => !isCanceledSale(lerMeta(venda)))

    const pagamentosConfirmados = vendasAtivas.length

    // Calcular faturamento total
    let faturamentoTotal = 0
    vendasAtivas.forEach((venda: any) => {
      faturamentoTotal += extractAmount(lerMeta(venda))
    })

    // Calcular ticket médio
    const ticketMedio = pagamentosConfirmados > 0
      ? faturamentoTotal / pagamentosConfirmados
      : 0

    // Toda venda confirmada passou por um checkout. Antes, "checkouts" contava
    // apenas boletos pendentes, então uma compra aprovada no cartão deixava o
    // card com Checkouts=0 e Confirmados=1 — e a taxa de conversão em 0%,
    // porque o divisor era zero.
    const checkoutsIniciados = pagamentosConfirmados + checkoutsPendentes + carrinhosAbandonados
    const checkoutsNaoTerminados = carrinhosAbandonados

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
      // PIX/boleto emitidos e ainda não pagos. Estavam sendo somados ao mesmo
      // número dos abandonados, e são coisas opostas: um ainda pode virar
      // venda, o outro já não vira.
      checkoutsAguardando: checkoutsPendentes,
      pagamentosConfirmados,
      taxaConversaoCheckout: `${taxaConversao.toFixed(1)}%`,
      ticketMedio: formatCurrency(ticketMedio),
      faturamento: formatCurrency(faturamentoTotal),
      connected: true,
      // Nenhum evento Hotmart chegou ainda nesta janela — distinto de "houve
      // movimento e deu zero". O card diferencia os dois.
      aguardandoPrimeiroEvento:
        pagamentosConfirmados === 0 && checkoutsPendentes === 0 && carrinhosAbandonados === 0,
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
