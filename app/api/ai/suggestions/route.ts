import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-mode',
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { metrics } = await request.json()

    const userRecord = await import('@/lib/prisma').then(m => m.prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    }))
    const plan = userRecord?.plan || 'FREE'
    const isScale = plan === 'SCALE'
    const isPro = plan === 'PRO' || isScale
    const suggestionsCount = isScale ? 5 : isPro ? 4 : 3

    // Se não houver API key, informar que o recurso não está configurado
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
      return NextResponse.json({
        suggestions: [
          {
            type: 'info',
            title: '🤖 IA não configurada',
            description: 'Para ativar sugestões personalizadas por IA, adicione sua chave OPENAI_API_KEY nas configurações do projeto.',
            priority: 'low',
          },
        ],
        mode: 'not_configured',
      })
    }

    // Se nenhuma integração estiver conectada (todos null), não chamar a IA
    const hasRealData = metrics.whatsapp !== null || metrics.facebook !== null || metrics.hotmart !== null
    if (!hasRealData) {
      return NextResponse.json({
        suggestions: [],
        mode: 'basic',
      })
    }

    // Mapear campos reais das APIs para o prompt
    // WhatsApp: API retorna conversasIniciadas, taxaResposta (string "73%"), leadsQualificados
    const wa = metrics.whatsapp || {}
    const waConversas = wa.conversasIniciadas ?? wa.conversas ?? 0
    const waTaxaResposta = parseFloat(String(wa.taxaResposta).replace('%', '')) || 0
    const waLeads = wa.leadsQualificados ?? 0
    const waMedia = wa.mediaConversasDia ?? 0
    const waNaoTerminadas = wa.conversasNaoTerminadas ?? 0

    // Facebook: API retorna impressoes, cliques, ctr (string "1.48%"), cpc (string "R$ 2.15"), gastos
    const fb = metrics.facebook || {}
    const fbImpressoes = fb.raw?.impressions ?? fb.impressoes ?? 0
    const fbCliques = fb.raw?.clicks ?? fb.cliques ?? 0
    const fbCtr = parseFloat(String(fb.ctr).replace('%', '')) || 0
    const fbCpc = parseFloat(String(fb.cpc).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0
    const fbGastos = parseFloat(String(fb.gastos).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0

    // Hotmart: API retorna pagamentosConfirmados, faturamento (string "R$ 36.015"), ticketMedio, taxaConversaoCheckout
    const hm = metrics.hotmart || {}
    const hmVendas = hm.raw?.totalSales ?? hm.pagamentosConfirmados ?? 0
    const hmReceita = hm.raw?.totalRevenue ?? (parseFloat(String(hm.faturamento).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0)
    const hmTicket = hm.raw?.averageTicket ?? (parseFloat(String(hm.ticketMedio).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0)
    const hmConversao = parseFloat(String(hm.taxaConversaoCheckout).replace('%', '')) || 0
    const hmCheckouts = hm.checkoutsIniciados ?? 0

    const depthInstruction = isScale
      ? 'Faça uma análise profunda com tendências, previsões e sugestões estratégicas avançadas.'
      : isPro
        ? 'Forneça análise detalhada com comparações e sugestões táticas específicas.'
        : 'Forneça análise básica focando nos pontos mais críticos.'

    const prompt = `Você é um especialista em marketing digital e vendas online. Analise as seguintes métricas de um funil de vendas e forneça ${suggestionsCount} sugestões práticas e acionáveis. ${depthInstruction}

**WhatsApp:**
- Conversas Iniciadas (30 dias): ${waConversas}
- Conversas Não Terminadas: ${waNaoTerminadas}
- Leads Qualificados: ${waLeads}
- Média de Conversas/Dia: ${waMedia}
- Taxa de Resposta: ${waTaxaResposta}%

**Facebook Ads:**
- Impressões: ${fbImpressoes}
- Cliques: ${fbCliques}
- CTR: ${fbCtr}%
- CPC: R$ ${fbCpc.toFixed(2)}
- Total Investido: R$ ${fbGastos.toFixed(2)}

**Hotmart:**
- Vendas Confirmadas: ${hmVendas}
- Checkouts Iniciados: ${hmCheckouts}
- Ticket Médio: R$ ${hmTicket.toFixed(2)}
- Receita Total: R$ ${hmReceita.toFixed(2)}
- Taxa de Conversão (Checkout→Venda): ${hmConversao}%

Retorne APENAS um JSON válido no formato:
{
  "suggestions": [
    {
      "type": "success|warning|info|error",
      "title": "Título curto",
      "description": "Descrição prática e acionável",
      "priority": "high|medium|low"
    }
  ]
}

Foque em:
1. Identificar problemas críticos
2. Sugerir otimizações específicas
3. Destacar pontos positivos
4. Propor testes A/B ou ajustes de estratégia`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um consultor especializado em marketing digital e funis de vendas. Sempre responda em português do Brasil com sugestões práticas.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const response = completion.choices[0].message.content
    let aiSuggestions: { suggestions?: any[] } = { suggestions: [] }
    try {
      aiSuggestions = JSON.parse(response || '{"suggestions": []}')
    } catch {
      aiSuggestions = { suggestions: [] }
    }

    return NextResponse.json({
      suggestions: aiSuggestions.suggestions || [],
      mode: 'ai',
      model: 'gpt-4o',
    })
  } catch (error: any) {
    console.error('Erro ao gerar sugestões de IA:', error)
    
    return NextResponse.json({
      suggestions: [
        {
          type: 'info',
          title: '🤖 IA Temporariamente Indisponível',
          description: 'Não foi possível gerar sugestões no momento. Tente novamente em alguns instantes.',
          priority: 'low',
        },
      ],
      mode: 'error',
      error: error.message,
    })
  }
}
