import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'demo' })

const PLATFORM_KNOWLEDGE = `
FlowSara é um SaaS de automação de funis de vendas, WhatsApp, análise de métricas e integrações.

PLANOS: FREE (básico), PRO (avançado), ENTERPRISE (completo).

INTEGRAÇÕES SUPORTADAS:
- WhatsApp Business (via número cadastrado)
- Meta Ads / Facebook Ads
- Hotmart, Kiwify, Eduzz, Monetizze, Perfect Pay (via webhooks)
- Stripe (cartão de crédito, assinatura recorrente)
- Mercado Pago (PIX, boleto, cartão)
- Google Analytics

FUNCIONALIDADES PRINCIPAIS:
- Dashboard com funil visual (estágios: Lead, Qualificado, Checkout, Pago)
- Tracking de leads via pixel JS instalado no site do cliente
- Analytics e métricas de campanha (Meta Ads, WhatsApp)
- Relatórios personalizados e exportação
- Metas e OKRs com progresso automático
- Base de afiliados com comissões
- Times e colaboradores com permissões por role
- Sara.AI (assistente inteligente integrada em todo o sistema)
- Central de Suporte com chamados e chat

ERROS COMUNS E SOLUÇÕES:
- Webhook não chegando: verificar HMAC secret na plataforma + URL correta na aba Webhooks
- PIX não confirmando: MERCADOPAGO_WEBHOOK_SECRET incorreto; aguardar até 30min; checar logs
- Lead não aparece: pixel JS não instalado ou instalado no lugar errado (deve ser no <head>)
- Login com Google não funciona: GOOGLE_CLIENT_ID/SECRET incorretos ou redirect URI não cadastrada
- Assinatura não ativou após pagamento: STRIPE_WEBHOOK_SECRET incorreto; verificar eventos recebidos
- 2FA não funciona: relógio do dispositivo desincronizado (totp é baseado em tempo)
- Dados sumindo: cache do navegador; limpar cookies e tentar novamente
- Funil vazio: estágios criados mas nenhum webhook/pixel enviando dados ainda

AUTENTICAÇÃO: NextAuth.js com credentials + Google OAuth. 2FA opcional via TOTP (Google Authenticator).
BANCO: PostgreSQL via Supabase. ORM: Prisma.
PAGAMENTOS: Stripe (recorrente mensal/anual) + Mercado Pago (PIX único).
EMAILS: Resend (transacional). Domínio: flowsara.com.br.
HOSPEDAGEM: Hostinger (Node.js gerenciado). PM2 para processo. Build: Next.js 16.
`

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const internalKey = request.headers.get('x-internal')
    const session     = await getServerSession(authOptions)
    const isInternal  = internalKey === process.env.CRON_SECRET
    const isAdmin     = (session?.user as any)?.role === 'ADMIN'
    if (!isInternal && !isAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user:     { select: { name: true, email: true, plan: true, subscriptionStatus: true, createdAt: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 10 },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo') {
      const demo = {
        summary: 'Análise indisponível — configure OPENAI_API_KEY.',
        possibleCause: 'Desconhecida', suggestedPriority: ticket.priority,
        category: ticket.type, affectedArea: 'Geral', complexity: 'medium',
        bugProbability: 0, userErrorProbability: 0,
        suggestions: ['Verificar configurações', 'Consultar documentação'],
        suggestedReply: 'Olá! Recebemos seu chamado e em breve nossa equipe entrará em contato.',
        relatedDocs: [], urgentFlags: [],
      }
      await prisma.supportTicket.update({ where: { id }, data: { aiSummary: JSON.stringify(demo) } })
      return NextResponse.json({ analysis: demo })
    }

    const convo = ticket.messages.map(m => `[${m.senderType.toUpperCase()}]: ${m.content}`).join('\n')

    const prompt = `Você é Sara.AI, especialista sênior em suporte da plataforma FlowSara. Analise o chamado abaixo com profundidade.

BASE DE CONHECIMENTO:
${PLATFORM_KNOWLEDGE}

DADOS DO CHAMADO:
- Usuário: ${ticket.user.name} (${ticket.user.email})
- Plano: ${ticket.user.plan} | Assinatura: ${ticket.user.subscriptionStatus ?? 'desconhecido'}
- Cliente desde: ${new Date(ticket.user.createdAt).toLocaleDateString('pt-BR')}
- Tipo declarado: ${ticket.type} | Prioridade declarada: ${ticket.priority}
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Histórico de mensagens:\n${convo}

Retorne SOMENTE um JSON (sem markdown) com estes campos exatos:
{
  "summary": "resumo do problema em 1-2 frases",
  "possibleCause": "causa mais provável",
  "suggestedPriority": "low|medium|high|critical",
  "category": "billing|integration|bug|ux|onboarding|performance|other",
  "affectedArea": "área do sistema afetada",
  "complexity": "low|medium|high",
  "bugProbability": 0-100,
  "userErrorProbability": 0-100,
  "suggestions": ["ação 1", "ação 2", "ação 3"],
  "suggestedReply": "resposta completa e empática para enviar ao cliente",
  "relatedDocs": ["documentação ou seção relevante"],
  "urgentFlags": ["alertas se houver algo crítico, ex: dados perdidos, pagamento falhou"]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const analysis = JSON.parse(completion.choices[0]?.message?.content ?? '{}')

    await prisma.supportTicket.update({
      where: { id },
      data: {
        aiSummary: JSON.stringify(analysis),
        ...(analysis.suggestedPriority === 'critical' && ticket.priority !== 'critical'
          ? { priority: 'critical' } : {}),
      },
    })
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('[ai POST]', err)
    return NextResponse.json({ error: 'Erro na análise da IA' }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { id } = await params

    const ticket = await prisma.supportTicket.findFirst({
      where: { id },
      select: { aiSummary: true },
    })
    if (!ticket) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const analysis = ticket.aiSummary ? JSON.parse(ticket.aiSummary) : null
    return NextResponse.json({ analysis })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
