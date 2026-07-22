import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getAdInsights } from '@/lib/facebook'
import { getHistoryLimitDays } from '@/lib/plans'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    const maxDays = getHistoryLimitDays(dbUser?.plan)
    const earliestAllowed = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)

    const { searchParams } = new URL(request.url)
    const requestedStart = new Date(searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    const startDate = requestedStart < earliestAllowed ? earliestAllowed : requestedStart
    const endDate = new Date(searchParams.get('endDate') || new Date().toISOString())

    // Buscar dados das integrações
    const [whatsappIntegration, metaIntegration, hotmartIntegration] = await Promise.all([
      prisma.integration.findFirst({
        where: { userId: session.user.id, platform: 'WHATSAPP', isActive: true },
      }),
      prisma.integration.findFirst({
        where: { userId: session.user.id, platform: 'META_ADS', isActive: true },
      }),
      prisma.integration.findFirst({
        where: { userId: session.user.id, platform: 'HOTMART', isActive: true },
      }),
    ])

    // Buscar funil do usuário
    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
    })

    // --- Dados reais do WhatsApp ---
    let whatsappData = null
    if (whatsappIntegration && funnel) {
      const conversas = await prisma.funnelEvent.count({
        where: {
          funnelId: funnel.id,
          eventType: 'whatsapp_conversation_started',
          timestamp: { gte: startDate, lte: endDate },
        },
      })

      const allConvs = await prisma.funnelEvent.findMany({
        where: {
          funnelId: funnel.id,
          eventType: 'whatsapp_conversation_started',
          timestamp: { gte: startDate, lte: endDate },
        },
      })

      let totalMessages = 0
      let totalResponseTimes = 0
      let responsesCount = 0

      for (const conv of allConvs) {
        let meta: Record<string, any> = {}
        try {
          meta = typeof conv.metadata === 'string' ? JSON.parse(conv.metadata) : (conv.metadata as any) || {}
        } catch { meta = {} }

        const interactions = meta.interactions || []
        totalMessages += interactions.length

        for (let i = 1; i < interactions.length; i++) {
          const prev = interactions[i - 1]
          const curr = interactions[i]
          if (prev.direction === 'inbound' && curr.direction === 'outbound') {
            const rt = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60)
            totalResponseTimes += rt
            responsesCount++
          }
        }
      }

      const taxaResposta = conversas > 0 ? ((responsesCount / conversas) * 100).toFixed(1) : '0'

      whatsappData = {
        conversas,
        mensagensEnviadas: totalMessages,
        mensagensRecebidas: totalMessages,
        taxaResposta: parseFloat(taxaResposta),
      }
    }

    // --- Dados reais do Facebook ---
    let facebookData = null
    if (metaIntegration) {
      let config: Record<string, any> = {}
      try {
        config = typeof metaIntegration.config === 'string' ? JSON.parse(metaIntegration.config) : (metaIntegration.config as any) || {}
      } catch { config = {} }

      const result = await getAdInsights(metaIntegration.accessToken, config.adAccountId, 'last_30d')
      if (result.success && result.data) {
        facebookData = {
          impressoes: result.data.impressions,
          cliques: result.data.clicks,
          ctr: result.data.ctr,
          custoTotal: result.data.spend,
          cpc: result.data.cpc,
        }
      }
    }

    // --- Dados reais do Hotmart ---
    let hotmartData = null
    if (hotmartIntegration && funnel) {
      const vendasCompletas = await prisma.funnelEvent.findMany({
        where: {
          funnelId: funnel.id,
          eventType: 'hotmart_purchase_complete',
          timestamp: { gte: startDate, lte: endDate },
        },
      })

      const vendasAtivas = vendasCompletas.filter((v: any) => {
        let meta: Record<string, any> = {}
        try {
          meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : (v.metadata as any) || {}
        } catch { meta = {} }
        return meta.status !== 'canceled'
      })

      let receitaTotal = 0
      vendasAtivas.forEach((v: any) => {
        let meta: Record<string, any> = {}
        try {
          meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : (v.metadata as any) || {}
        } catch { meta = {} }
        receitaTotal += parseFloat(meta.price || 0)
      })

      const checkoutsIniciados = await prisma.funnelEvent.count({
        where: {
          funnelId: funnel.id,
          eventType: 'hotmart_checkout_started',
          timestamp: { gte: startDate, lte: endDate },
        },
      })

      hotmartData = {
        vendas: vendasAtivas.length,
        ticketMedio: vendasAtivas.length > 0 ? receitaTotal / vendasAtivas.length : 0,
        receitaTotal,
        conversao: checkoutsIniciados > 0 ? ((vendasAtivas.length / checkoutsIniciados) * 100) : 0,
      }
    }

    // Criar PDF
    const doc = new jsPDF()

    // Header
    doc.setFontSize(20)
    doc.setTextColor(59, 130, 246)
    doc.text('Relatório de Métricas', 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`, 14, 28)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 34)
    doc.text(`Usuário: ${session.user.email}`, 14, 40)

    let yPosition = 50

    // WhatsApp Section
    if (whatsappIntegration) {
      doc.setFontSize(14)
      doc.setTextColor(34, 197, 94)
      doc.text('📱 WhatsApp', 14, yPosition)
      yPosition += 10

      if (whatsappData) {
        autoTable(doc, {
          startY: yPosition,
          head: [['Métrica', 'Valor']],
          body: [
            ['Conversas no Período', whatsappData.conversas.toLocaleString('pt-BR')],
            ['Total de Mensagens', whatsappData.mensagensEnviadas.toLocaleString('pt-BR')],
            ['Taxa de Resposta', `${whatsappData.taxaResposta}%`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [34, 197, 94] },
        })
      } else {
        doc.setFontSize(10)
        doc.setTextColor(150, 150, 150)
        doc.text('Dados não disponíveis para o período selecionado.', 14, yPosition)
        yPosition += 10
      }

      yPosition = (doc as any).lastAutoTable?.finalY + 15 || yPosition + 15
    }

    // Facebook Ads Section
    if (metaIntegration) {
      doc.setFontSize(14)
      doc.setTextColor(59, 130, 246)
      doc.text('📊 Facebook Ads', 14, yPosition)
      yPosition += 10

      if (facebookData) {
        autoTable(doc, {
          startY: yPosition,
          head: [['Métrica', 'Valor']],
          body: [
            ['Impressões', facebookData.impressoes.toLocaleString('pt-BR')],
            ['Cliques', facebookData.cliques.toLocaleString('pt-BR')],
            ['CTR (Taxa de Cliques)', `${facebookData.ctr.toFixed(2)}%`],
            ['Custo Total', `R$ ${facebookData.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ['CPC (Custo por Clique)', `R$ ${facebookData.cpc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
        })
      } else {
        doc.setFontSize(10)
        doc.setTextColor(150, 150, 150)
        doc.text('Dados não disponíveis. Verifique a conexão com a API do Facebook.', 14, yPosition)
        yPosition += 10
      }

      yPosition = (doc as any).lastAutoTable?.finalY + 15 || yPosition + 15
    }

    // Hotmart Section
    if (hotmartIntegration) {
      if (yPosition > 220) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(249, 115, 22)
      doc.text('💰 Hotmart', 14, yPosition)
      yPosition += 10

      if (hotmartData) {
        autoTable(doc, {
          startY: yPosition,
          head: [['Métrica', 'Valor']],
          body: [
            ['Total de Vendas', hotmartData.vendas.toLocaleString('pt-BR')],
            ['Ticket Médio', `R$ ${hotmartData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ['Receita Total', `R$ ${hotmartData.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
            ['Taxa de Conversão', `${hotmartData.conversao.toFixed(1)}%`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [249, 115, 22] },
        })
      } else {
        doc.setFontSize(10)
        doc.setTextColor(150, 150, 150)
        doc.text('Dados não disponíveis para o período selecionado.', 14, yPosition)
        yPosition += 10
      }

      yPosition = (doc as any).lastAutoTable?.finalY + 15 || yPosition + 15
    }

    // Resumo Geral (apenas quando há dados reais das duas plataformas)
    if (facebookData && hotmartData && facebookData.custoTotal > 0 && hotmartData.vendas > 0) {
      if (yPosition > 200) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(139, 92, 246)
      doc.text('📈 Resumo Geral', 14, yPosition)
      yPosition += 10

      const roi = ((hotmartData.receitaTotal - facebookData.custoTotal) / facebookData.custoTotal) * 100
      const cac = facebookData.custoTotal / hotmartData.vendas
      const conversaoGeral = facebookData.cliques > 0
        ? ((hotmartData.vendas / facebookData.cliques) * 100).toFixed(2)
        : 'N/D'

      autoTable(doc, {
        startY: yPosition,
        head: [['Indicador', 'Valor']],
        body: [
          ['ROI (Retorno sobre Investimento)', `${roi.toFixed(2)}%`],
          ['CAC (Custo de Aquisição por Cliente)', `R$ ${cac.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Conversão Geral (Cliques → Vendas)', `${conversaoGeral}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246] },
      })
    }

    if (!whatsappIntegration && !metaIntegration && !hotmartIntegration) {
      doc.setFontSize(12)
      doc.setTextColor(150, 150, 150)
      doc.text('Nenhuma integração conectada. Conecte suas plataformas em Configurações.', 14, yPosition)
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    const pdfBuffer = doc.output('arraybuffer')

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar relatório PDF' },
      { status: 500 }
    )
  }
}
