import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { FLOW_AI } from '@/lib/ai-identity'
import { SaraContextService, PageContext } from '@/lib/sara-context-service'
import { SaraMemoryService } from '@/lib/sara-memory'
import { checkRateLimit } from '@/lib/security-utils'
import { sanitizeChatMessages, sanitizePageContext, checkAiAccess, logAI } from '@/lib/ai-guard'

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

  // ── Build rich context via SaraContextService (cached 5 min) ─────────────
  const context = await SaraContextService.buildContext(session.user.id, pageContext)

  // ── Auto-extract intentions from last user message and save to memory ─────
  const lastUserMsg = messages.filter(m => m.role === 'user').at(-1)
  if (lastUserMsg) {
    const intention = SaraMemoryService.extractIntentions(lastUserMsg.content)
    if (intention) {
      SaraMemoryService.save(
        session.user.id,
        intention.type,
        intention.content,
        pageContext?.pathname,
      ).catch(() => {}) // fire-and-forget, non-blocking
    }
  }

  // ── System prompt ─────────────────────────────────────────────────────────
  const memoriesBlock = context.memories
    ? `\nMEMÓRIAS DO USUÁRIO (preferências, objetivos, decisões anteriores):\n${context.memories}`
    : ''

  const systemPrompt = `${FLOW_AI.systemPrompt}

${context.systemContext}
${memoriesBlock}

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
  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  const MODEL = 'gpt-4o-mini'
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
