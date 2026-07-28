/**
 * SaraAIService — serviço centralizado de IA do FlowSara.
 *
 * Responsabilidades:
 *  - Analisar tickets de suporte
 *  - Gerar sugestões de resposta
 *  - Consultar base de conhecimento
 *  - Registrar todos os logs de IA (custo, tokens, duração)
 *  - Manter contexto da conversa
 */

import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL = 'gpt-4o-mini'
// GPT-4o-mini pricing (USD per 1K tokens, approximate)
const COST_INPUT_PER_1K  = 0.000150
const COST_OUTPUT_PER_1K = 0.000600

export const PLATFORM_KNOWLEDGE = `
FlowSara é um SaaS brasileiro de automação de funis de vendas, tracking de leads, WhatsApp, análise de métricas e integrações com plataformas de marketing digital.

PLANOS:
- FREE: acesso básico, funcionalidades limitadas, sem IA avançada
- PRO: funil completo, analytics, Sara.AI ativa, integrações todas
- ENTERPRISE: tudo do PRO + time, API, SLA, suporte prioritário

INTEGRAÇÕES SUPORTADAS (via webhook HMAC):
- WhatsApp Business (número cadastrado, tracking de conversas)
- Meta Ads / Facebook Ads (cliques, impressões, gasto)
- Hotmart (vendas, reembolsos, assinaturas)
- Kiwify (vendas, checkouts)
- Eduzz (vendas, comissões)
- Monetizze (vendas, reembolsos)
- Perfect Pay (vendas, recuperações)
- Stripe (assinaturas recorrentes, cartão)
- Mercado Pago (PIX, boleto, cartão)
- Google Analytics (eventos, sessões)

FUNCIONALIDADES PRINCIPAIS:
- Dashboard com funil visual interativo (arrastar cards entre estágios)
- Tracking de leads via pixel JavaScript instalado no site do cliente
- Jornada do lead (timeline completa de eventos)
- Analytics de campanha (ROI, CPA, ROAS por plataforma)
- Relatórios exportáveis
- Metas e OKRs com progresso automático
- Base de afiliados com comissão configurável
- Times e colaboradores (ADMIN / PRODUTOR / VIEWER)
- 2FA via TOTP (Google Authenticator)
- Sara.AI (assistente inteligente em tempo real)
- Central de Suporte com tickets e IA

ERROS COMUNS E SOLUÇÕES:
- Webhook não chega: verificar URL correta, HMAC secret exato e plataforma ativa na aba Webhooks
- PIX não confirma: MERCADOPAGO_WEBHOOK_SECRET incorreto; aguardar até 30min; ver logs de webhook
- Lead não aparece: pixel JS não instalado ou mal-instalado (deve ficar no <head> de TODAS as páginas)
- Google OAuth falha: GOOGLE_CLIENT_ID/SECRET incorretos ou redirect URI ausente no console Google
- Assinatura não ativou: STRIPE_WEBHOOK_SECRET incorreto; confirmar eventos configurados no dashboard Stripe
- 2FA não funciona: relógio do dispositivo desincronizado (TOTP depende de tempo exato)
- Dados sumindo: cache do navegador ou sessão expirada; limpar cookies e reconectar
- Funil vazio: estágios criados mas nenhuma fonte (webhook/pixel) enviando dados ainda
- Erro 503 produção: PM2 travou; admin deve rodar "pm2 restart flowsara" no servidor Hostinger
- Número WhatsApp não conecta: verificar se o número está aprovado no WhatsApp Business API

STACK TÉCNICA:
- Frontend/Backend: Next.js 16 App Router (TypeScript)
- Banco: PostgreSQL via Supabase, ORM Prisma
- Auth: NextAuth.js v4 (credentials + Google OAuth)
- Pagamentos: Stripe + Mercado Pago
- Email: Resend (domínio flowsara.com.br)
- Hospedagem: Hostinger Node.js gerenciado, PM2, build via npm run build
- IA: OpenAI gpt-4o-mini
`.trim()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TicketAnalysis {
  summary:               string
  possibleCause:         string
  suggestedPriority:     'low' | 'medium' | 'high' | 'critical'
  category:              string
  affectedArea:          string
  complexity:            'low' | 'medium' | 'high'
  bugProbability:        number
  userErrorProbability:  number
  suggestions:           string[]
  suggestedReply:        string
  relatedDocs:           string[]
  urgentFlags:           string[]
}

export interface UserContext {
  id:                 string
  name:               string | null
  email:              string
  plan:               string
  subscriptionStatus: string | null
  createdAt:          Date
}

export interface MessageContext {
  senderType: string
  content:    string
  createdAt:  Date
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SaraAIService {
  private openai: OpenAI
  private isDemoMode: boolean

  constructor() {
    const apiKey     = process.env.OPENAI_API_KEY
    this.isDemoMode  = !apiKey || apiKey === 'demo'
    this.openai      = new OpenAI({ apiKey: apiKey ?? 'demo' })
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Analisa um ticket de suporte e persiste o resultado + AILog. */
  async analyzeTicket(ticket: {
    id:          string
    subject:     string
    description: string
    type:        string
    priority:    string
    number:      number
  }, user: UserContext, messages: MessageContext[]): Promise<TicketAnalysis> {
    if (this.isDemoMode) return this.demoAnalysis(ticket.type, ticket.priority)

    const kbContext  = await this.getKBContext(ticket.subject + ' ' + ticket.description)
    const convo      = messages
      .map(m => `[${m.senderType.toUpperCase()}]: ${m.content}`)
      .join('\n')

    const systemMsg = `Você é Sara.AI, especialista sênior em suporte da plataforma FlowSara. Responda SOMENTE com JSON válido (sem markdown).`

    const userMsg = `BASE DE CONHECIMENTO DA PLATAFORMA:\n${PLATFORM_KNOWLEDGE}
${kbContext ? `\nARTIGOS RELEVANTES DA KB:\n${kbContext}` : ''}

DADOS DO CHAMADO #${ticket.number}:
- Usuário: ${user.name ?? 'Sem nome'} (${user.email})
- Plano: ${user.plan} | Assinatura: ${user.subscriptionStatus ?? 'desconhecida'}
- Cliente desde: ${user.createdAt.toLocaleDateString('pt-BR')}
- Tipo: ${ticket.type} | Prioridade declarada: ${ticket.priority}
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Mensagens (${messages.length}):\n${convo || '(sem mensagens além da descrição)'}

Retorne exatamente este JSON:
{
  "summary": "resumo do problema em 1-2 frases objetivas",
  "possibleCause": "causa mais provável com base nos dados",
  "suggestedPriority": "low|medium|high|critical",
  "category": "billing|integration|bug|ux|onboarding|performance|other",
  "affectedArea": "área específica do sistema afetada",
  "complexity": "low|medium|high",
  "bugProbability": 0-100,
  "userErrorProbability": 0-100,
  "suggestions": ["ação concreta 1", "ação concreta 2", "ação concreta 3"],
  "suggestedReply": "resposta completa, empática e profissional para enviar ao cliente",
  "relatedDocs": ["seção ou funcionalidade relacionada"],
  "urgentFlags": ["alerta crítico se houver — ex: pagamento falhou, dados em risco"]
}`

    const startMs = Date.now()
    const completion = await this.openai.chat.completions.create({
      model:           MODEL,
      messages:        [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
      temperature:     0.2,
      max_tokens:      1000,
      response_format: { type: 'json_object' },
    })
    const durationMs = Date.now() - startMs

    const analysis = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as TicketAnalysis
    const usage    = completion.usage

    await this.logAI({
      ticketId:      ticket.id,
      userId:        user.id,
      action:        'analyze_ticket',
      promptTokens:  usage?.prompt_tokens    ?? 0,
      completTokens: usage?.completion_tokens ?? 0,
      totalTokens:   usage?.total_tokens      ?? 0,
      durationMs,
      category:      analysis.category,
    })

    return analysis
  }

  /** Registra se o admin aceitou uma sugestão da IA (para métricas de aceitação). */
  async markSuggestionAccepted(ticketId: string, accepted: boolean): Promise<void> {
    await prisma.aILog.updateMany({
      where:  { ticketId, action: 'analyze_ticket' },
      data:   { accepted },
    })
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getKBContext(query: string): Promise<string> {
    try {
      const articles = await prisma.knowledgeArticle.findMany({
        where:   { published: true },
        select:  { title: true, content: true, category: true, tags: true },
        take:    5,
        orderBy: { updatedAt: 'desc' },
      })
      if (!articles.length) return ''
      // Simple keyword matching (production: use embeddings)
      const queryLower  = query.toLowerCase()
      const relevant    = articles.filter(a =>
        a.title.toLowerCase().includes(queryLower.slice(0, 20)) ||
        (a.tags ?? '').toLowerCase().includes(queryLower.slice(0, 10))
      )
      const toUse = relevant.length ? relevant : articles.slice(0, 2)
      return toUse.map(a => `### ${a.title}\n${a.content.slice(0, 400)}`).join('\n\n')
    } catch {
      return ''
    }
  }

  private async logAI(data: {
    ticketId?:     string
    userId?:       string
    action:        string
    promptTokens:  number
    completTokens: number
    totalTokens:   number
    durationMs:    number
    category?:     string
  }): Promise<void> {
    const costUsd = (data.promptTokens  / 1000) * COST_INPUT_PER_1K
                  + (data.completTokens / 1000) * COST_OUTPUT_PER_1K
    try {
      await prisma.aILog.create({
        data: {
          ticketId:      data.ticketId,
          userId:        data.userId,
          action:        data.action,
          model:         MODEL,
          promptTokens:  data.promptTokens,
          completTokens: data.completTokens,
          totalTokens:   data.totalTokens,
          durationMs:    data.durationMs,
          costUsd,
          category:      data.category,
        },
      })
    } catch (err) {
      console.error('[SaraAIService] logAI failed:', err)
    }
  }

  private demoAnalysis(type: string, priority: string): TicketAnalysis {
    return {
      summary:              'Análise indisponível — configure OPENAI_API_KEY nas variáveis de ambiente.',
      possibleCause:        'Desconhecida',
      suggestedPriority:    priority as any,
      category:             type,
      affectedArea:         'Geral',
      complexity:           'medium',
      bugProbability:       0,
      userErrorProbability: 0,
      suggestions:          ['Verificar configurações da conta', 'Consultar documentação', 'Contatar suporte'],
      suggestedReply:       'Olá! Recebemos seu chamado e nossa equipe entrará em contato em breve. Obrigado por usar o FlowSara!',
      relatedDocs:          [],
      urgentFlags:          [],
    }
  }
}

// Singleton
export const saraAI = new SaraAIService()
