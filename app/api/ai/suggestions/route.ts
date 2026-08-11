import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { checkRateLimit } from '@/lib/security-utils'
import { checkAiAccess, logAI } from '@/lib/ai-guard'

/**
 * Coage qualquer entrada do cliente a número finito.
 *
 * Estes valores são interpolados no prompt. Sem a coerção, `?? 0` deixava
 * passar string arbitrária — um payload grande num único campo virava centenas
 * de milhares de tokens de entrada, no modelo mais caro.
 */
function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(/[^0-9,.-]/g, '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-mode',
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`ai:suggestions:${session.user.id}`, 15, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas, aguarde um instante.' }, { status: 429 })
    }

    const access = await checkAiAccess(session.user.id, 'suggestions')
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { metrics } = await request.json()
    if (!metrics || typeof metrics !== 'object') {
      return NextResponse.json({ error: 'Métricas inválidas' }, { status: 400 })
    }

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
    const waConversas = num(wa.conversasIniciadas ?? wa.conversas)
    const waTaxaResposta = num(wa.taxaResposta)
    const waLeads = num(wa.leadsQualificados)
    const waMedia = num(wa.mediaConversasDia)
    const waNaoTerminadas = num(wa.conversasNaoTerminadas)

    // Facebook: API retorna impressoes, cliques, ctr (string "1.48%"), cpc (string "R$ 2.15"), gastos
    const fb = metrics.facebook || {}
    const fbImpressoes = num(fb.raw?.impressions ?? fb.impressoes)
    const fbCliques = num(fb.raw?.clicks ?? fb.cliques)
    const fbCtr = num(fb.ctr)
    const fbCpc = num(fb.cpc)
    const fbGastos = num(fb.gastos)

    // Hotmart: API retorna pagamentosConfirmados, faturamento (string "R$ 36.015"), ticketMedio, taxaConversaoCheckout
    const hm = metrics.hotmart || {}
    const hmVendas = num(hm.raw?.totalSales ?? hm.pagamentosConfirmados)
    const hmReceita = num(hm.raw?.totalRevenue ?? hm.faturamento)
    const hmTicket = num(hm.raw?.averageTicket ?? hm.ticketMedio)
    const hmConversao = num(hm.taxaConversaoCheckout)
    const hmCheckouts = num(hm.checkoutsIniciados)

    const depthInstruction = isScale
      ? 'Faça uma análise profunda com tendências, previsões e sugestões estratégicas avançadas.'
      : isPro
        ? 'Forneça análise detalhada com comparações e sugestões táticas específicas.'
        : 'Forneça análise básica focando nos pontos mais críticos.'

    // Contexto de atribuição real (jornadas rastreadas → vendas vinculadas)
    let attributionContext = ''
    try {
      const { getAttributionSummary } = await import('@/lib/journey')
      const summary = await getAttributionSummary(session.user.id, 30)
      if (summary.total > 0) {
        const campaigns = Object.entries(summary.byCampaign)
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 5)
          .map(([name, v]) => `  - ${name}: ${v.count} vendas, R$ ${v.revenue.toFixed(2)}`)
          .join('\n')
        attributionContext = `

**Atribuição de Vendas (30 dias — dados reais de rastreamento):**
- Vendas atribuídas: ${summary.total}
- Vínculo determinístico (clique→venda confirmado): ${(summary.deterministicShare * 100).toFixed(0)}%
- Receita por campanha:
${campaigns}`
      }
    } catch (attrErr) {
      console.error('[flow-ai] attribution summary unavailable:', attrErr)
    }

    const prompt = `Você é um especialista em marketing digital e vendas online. Analise as seguintes métricas de um funil de vendas e forneça ${suggestionsCount} sugestões práticas e acionáveis. ${depthInstruction}${attributionContext}

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

    const SUGGESTIONS_MODEL = 'gpt-4o'
    const startedAt = Date.now()

    const completion = await openai.chat.completions.create({
      model: SUGGESTIONS_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Você é a Sara.ai, assistente inteligente oficial da FlowSara. Especialista em marketing digital, funis de vendas, métricas e automações. Sempre responda em português do Brasil com sugestões práticas e acionáveis. Nunca se identifique como GPT, ChatGPT ou qualquer produto da OpenAI.',
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

    await logAI({
      userId: session.user.id,
      action: 'suggestions',
      model: SUGGESTIONS_MODEL,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
      durationMs: Date.now() - startedAt,
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
      model: SUGGESTIONS_MODEL,
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
    })
  }
}
