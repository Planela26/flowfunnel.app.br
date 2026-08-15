import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { FLOW_AI } from '@/lib/ai-identity'
import { SaraContextService, PageContext } from '@/lib/sara-context-service'
import { SaraMemoryService } from '@/lib/sara-memory'
import { checkRateLimit } from '@/lib/security-utils'
import { sanitizeChatMessages, sanitizePageContext, checkAiAccess, logAI } from '@/lib/ai-guard'
import {
  detectComparisonRequest,
  comparePeriods,
  formatComparisonForPrompt,
} from '@/lib/analytics-comparison'
import { getSaraCapabilities } from '@/lib/sara-capabilities'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'demo-mode' })

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const rl = await checkRateLimit(`ai:chat:${session.user.id}`, 20, 60_000)
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Muitas mensagens, aguarde um instante.' }), { status: 429 })
  }

  const access = await checkAiAccess(session.user.id, 'chat')
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), { status: access.status })
  }

  let rawBody: any
  try {
    rawBody = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Corpo da requisição inválido' }), { status: 400 })
  }

  // O tipo TS não existe em runtime: sem esta validação o cliente podia enviar
  // role:"system" e sobrepor o prompt legítimo.
  const parsed = sanitizeChatMessages(rawBody?.messages)
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 })
  }
  const messages = parsed.messages
  const pageContext = sanitizePageContext(rawBody?.pageContext) as PageContext | undefined

  // Plano EFETIVO recém-lido do banco por `checkAiAccess`. É desta variável —
  // e não do contexto — que sai toda decisão de capacidade.
  const planoAtual = access.access.plan

  // ── Build rich context via SaraContextService (cached 5 min) ─────────────
  // O plano entra na chave do cache: sem isso, uma conta que muda de plano
  // continuaria recebendo o contexto do plano anterior (inclusive a cota de
  // memória) até a entrada expirar.
  const context = await SaraContextService.buildContext(session.user.id, pageContext, planoAtual)

  // Capacidades derivadas do plano fresco. Antes vinham de `context.capabilities`,
  // que é CACHEADO por 5 minutos: logo após um downgrade, o usuário continuava
  // recebendo a comparação histórica do SCALE — autorização servida de cache.
  const caps = getSaraCapabilities(planoAtual)

  // ── Auto-extract intentions from last user message and save to memory ─────

  const lastUserMsg = messages.filter(m => m.role === 'user').at(-1)
  if (lastUserMsg) {
    const intention = SaraMemoryService.extractIntentions(lastUserMsg.content)
    if (intention) {
      // O plano vem do contexto já resolvido (inclui trial), evitando outra
      // consulta ao banco. `save` devolve null se o plano não tem memória.
      SaraMemoryService.save(
        session.user.id,
        intention.type,
        intention.content,
        pageContext?.pathname,
        { plan: planoAtual, importance: intention.importance, source: 'auto' },
      ).catch(() => {}) // fire-and-forget, non-blocking
    }
  }

  // ── Comparação histórica: calculada no backend, interpretada pela Sara ─────
  //
  // Os números chegam prontos ao modelo. Pedir que ele derive variação
  // percentual a partir de dados brutos é onde um LLM inventa com mais
  // confiança — e num painel de métricas o número inventado é indistinguível
  // do real. Só planos com `historicalComparison` recebem este bloco.
  let comparisonBlock = ''
  if (caps.historicalComparison && lastUserMsg) {
    const pedido = detectComparisonRequest(lastUserMsg.content)
    if (pedido) {
      try {
        const resultado = await comparePeriods(session.user.id, pedido.start, pedido.end, {
          current: pedido.label,
          previous: pedido.previousLabel,
        })
        comparisonBlock = `\n${formatComparisonForPrompt(resultado)}`
      } catch (err) {
        // Falha aqui não derruba a conversa: a Sara responde sem os números,
        // que é melhor que devolver erro para uma pergunta legítima.
        console.error('[ai/chat] comparação falhou:', err)
      }
    }
  }

  // ── System prompt ─────────────────────────────────────────────────────────
  const memoriesBlock = context.memories
    ? `\nMEMÓRIAS DO USUÁRIO (preferências, objetivos, decisões anteriores):\n${context.memories}`
    : ''

  // Profundidade da análise por plano. Não há atraso artificial em lugar
  // nenhum: o START responde tão rápido quanto o SCALE, com menos alcance.
  const depthBlock = caps.advancedDiagnostics
    ? `
MODO DE ANÁLISE — ${caps.label}:
- Faça diagnóstico completo: aponte a causa provável, não apenas o sintoma.
- Cruze métricas relacionadas antes de concluir (ex.: volume contra conversão).
- Analise campanhas quando forem relevantes para a pergunta.
- Janela de dados disponível: até ${caps.analysisWindowDays} dias.`
    : `
MODO DE ANÁLISE — ${caps.label}:
- Responda de forma direta e objetiva, explicando as métricas com clareza.
- Baseie-se no período mais recente; janela disponível: ${caps.analysisWindowDays} dias.
- Diagnóstico aprofundado, cruzamento de métricas e análise de campanhas não
  fazem parte deste modo. Se o usuário pedir isso, responda o que der com os
  dados atuais e diga que a análise avançada faz parte da SARA.AI+ 2.0, no
  plano PRO. Nunca invente a análise que você não pode fazer.`

  const strategicBlock = caps.strategicRecommendations
    ? `
CAMADA ESTRATÉGICA (exclusiva deste plano):
- Interprete a EVOLUÇÃO, não só o número do período: o que mudou e por quê.
- Aponte anomalias e relações entre métricas (ex.: volume subindo com
  conversão caindo indica queda de qualidade, não sucesso).
- Identifique em qual etapa do funil está a maior perda.
- Feche com recomendação acionável: o que investigar ou fazer a seguir.
- Acompanhe os objetivos que o usuário já declarou nas memórias.`
    : ''

  const systemPrompt = `${FLOW_AI.systemPrompt}

${context.systemContext}
${memoriesBlock}${comparisonBlock}
${depthBlock}${strategicBlock}

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
- Suporte: /suporte
- Sara.AI: disponível em toda a plataforma via widget flutuante

INSTRUÇÕES:
- Use os dados reais do contexto para personalizar todas as respostas.
- NUNCA invente números, porcentagens, vendas, leads, conversões ou tendências.
  Todo valor quantitativo deve vir do contexto acima. Se o dado não estiver
  disponível, diga "não tenho dados suficientes para concluir isso".
- Quando mencionar o usuário por identificador, use o ID FlowSara (ex: FLS-2A9KX8), nunca o ID interno.
- Quando mencionar uma página da plataforma, inclua o caminho entre parênteses.
- Seja direto e objetivo. Prefira listas e tópicos a parágrafos longos.
- ${FLOW_AI.disclaimer}`

  // ── Demo mode (sem API key) ───────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
    const demoResp = `Olá! Sou a **Sara.AI**, inteligência central do FlowSara. 🤖\n\nPara ativar o assistente com acesso aos seus dados reais, configure a variável **OPENAI_API_KEY** nas configurações do projeto.\n\nAssim poderei analisar seu funil, métricas e campanhas em tempo real!`
    const encoder  = new TextEncoder()
    const stream   = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: demoResp })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
  }

  // ── Streaming OpenAI ──────────────────────────────────────────────────────
  // Janela de conversa por plano. `sanitizeChatMessages` já limita a 30 no
  // total (teto de abuso); aqui o corte é de capacidade, e mantém as mensagens
  // mais RECENTES, que é o que dá continuidade ao diálogo.
  const janela = messages.slice(-caps.maxContextMessages)

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...janela.map(m => ({ role: m.role, content: m.content })),
  ]

  // Igual em todos os planos nesta entrega — a diferenciação é de capacidade,
  // não de custo por token. Trocar o modelo de um plano é uma linha em
  // `lib/sara-capabilities`, sem caçar strings pelas rotas.
  const MODEL = caps.model
  const startedAt = Date.now()

  let openaiStream
  try {
    openaiStream = await openai.chat.completions.create({
      model:       MODEL,
      messages:    openaiMessages,
      stream:      true,
      max_tokens:  800,
      temperature: 0.7,
      // Em streaming a OpenAI só envia o consumo se pedirmos explicitamente.
      // Sem isto não há como registrar custo desta rota.
      stream_options: { include_usage: true },
    })
  } catch (error) {
    console.error('Erro ao iniciar stream da OpenAI:', error)
    return new Response(JSON.stringify({ error: 'Erro ao gerar resposta' }), { status: 502 })
  }

  const encoder  = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined
      try {
        for await (const chunk of openaiStream) {
          // O chunk final de usage não traz choices.
          if ((chunk as any).usage) usage = (chunk as any).usage
          const delta = chunk.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Erro ao gerar resposta' })}\n\n`))
      } finally {
        controller.close()
        // Registra o custo mesmo se o stream falhou no meio: os tokens de
        // entrada já foram cobrados pela OpenAI.
        logAI({
          userId: session.user!.id,
          action: 'chat',
          model: MODEL,
          promptTokens: usage?.prompt_tokens ?? 0,
          completTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          durationMs: Date.now() - startedAt,
        }).catch(() => {})
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
