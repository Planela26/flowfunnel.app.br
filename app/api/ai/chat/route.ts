import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { FLOW_AI } from '@/lib/ai-identity'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'demo-mode' })

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const { messages } = await request.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  // ── Busca contexto real do usuário ──────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      plan: true,
      subscriptionStatus: true,
      integrations: { select: { platform: true, createdAt: true } },
    },
  })

  const integrationNames = (user?.integrations ?? []).map(i => i.platform)
  const plan = user?.plan ?? 'FREE'
  const statusSub = user?.subscriptionStatus ?? 'unknown'

  // Snapshot de métricas (último disponível)
  const snapshot = await prisma.metricSnapshot.findFirst({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    select: {
      whatsappLeads: true,
      whatsappConversions: true,
      facebookClicks: true,
      facebookImpressions: true,
      facebookSpend: true,
      hotmartSales: true,
      hotmartRevenue: true,
      date: true,
    },
  }).catch(() => null)

  // Funil atual
  const funnel = await prisma.funnel.findFirst({
    where: { userId: session.user.id },
    select: {
      name: true,
      stages: {
        select: { name: true, leadCount: true, conversionRate: true, order: true },
        orderBy: { order: 'asc' },
      },
    },
  }).catch(() => null)

  // Leads recentes (contagem)
  const leadCount = await prisma.trackedLead.count({
    where: { userId: session.user.id },
  }).catch(() => 0)

  // ── Monta contexto para o system prompt ────────────────────────────────
  const integracoesStr = integrationNames.length > 0
    ? integrationNames.join(', ')
    : 'nenhuma integração conectada'

  const metricsStr = snapshot ? [
    snapshot.whatsappLeads != null && `WhatsApp: ${snapshot.whatsappLeads} leads, ${snapshot.whatsappConversions ?? 0} conversões`,
    snapshot.facebookClicks != null && `Meta Ads: ${snapshot.facebookClicks} cliques, ${snapshot.facebookImpressions ?? 0} impressões, R$ ${snapshot.facebookSpend?.toFixed(2) ?? '0'} gasto`,
    snapshot.hotmartSales != null && `Hotmart: ${snapshot.hotmartSales} vendas, R$ ${snapshot.hotmartRevenue?.toFixed(2) ?? '0'} receita`,
  ].filter(Boolean).join(' | ') : 'sem dados de métricas disponíveis'

  const funnelStr = funnel
    ? `Funil "${funnel.name}": ${funnel.stages.map(s => `${s.name}(${s.leadCount ?? 0} leads)`).join(' → ')}`
    : 'sem funil configurado'

  const contextBlock = `
CONTEXTO DO USUÁRIO:
- Nome: ${user?.name ?? 'Usuário'}
- Plano: ${plan} | Status da assinatura: ${statusSub}
- Integrações conectadas: ${integracoesStr}
- Métricas recentes (${snapshot?.date?.toLocaleDateString('pt-BR') ?? 'sem data'}): ${metricsStr}
- Funil: ${funnelStr}
- Total de leads rastreados: ${leadCount}
`.trim()

  const systemPrompt = `${FLOW_AI.systemPrompt}

${contextBlock}

GUIA DE NAVEGAÇÃO DA PLATAFORMA:
- Dashboard principal: /dashboard
- Analytics e métricas: /analises
- Leads e CRM: /leads
- Campanhas: /campanhas
- Funil visual: /dashboard (aba Funil)
- Relatórios: /relatorios
- Metas: /metas
- Configurações gerais: /configuracoes
- Integrações: /configuracoes (aba Integrações)
- WhatsApp: /whatsapp-connect
- Faturamento / plano: /faturamento
- Afiliados: /afiliado
- Segurança: /configuracoes/segurança
- Documentação: /docs

INSTRUÇÕES:
- Use os dados reais acima para personalizar todas as respostas.
- Quando mencionar uma página da plataforma, inclua o caminho entre parênteses.
- Seja direto e objetivo. Prefira listas e tópicos a parágrafos longos.
- ${FLOW_AI.disclaimer}`

  // ── Demo mode (sem API key) ──────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
    const demoResp = `Olá! Sou a **Sara.ai**, assistente da FlowSara. 🤖\n\nPara ativar o chat inteligente com acesso aos seus dados reais, configure a variável **OPENAI_API_KEY** nas configurações do projeto.\n\nAssim poderei analisar seu funil, métricas e campanhas em tempo real!`
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: demoResp })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
  }

  // ── Streaming OpenAI ─────────────────────────────────────────────────────
  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  const openaiStream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: openaiMessages,
    stream: true,
    max_tokens: 800,
    temperature: 0.7,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          const delta = chunk.choices[0]?.delta?.content ?? ''
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
          }
          if (chunk.choices[0]?.finish_reason === 'stop') break
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Erro ao gerar resposta' })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
