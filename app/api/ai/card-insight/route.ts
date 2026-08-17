import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { checkRateLimit } from '@/lib/security-utils'
import { checkAiAccess, logAI } from '@/lib/ai-guard'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-mode',
})

const CARD_PROMPTS: Record<string, (data: any) => string> = {
  facebook: (data) => `
Você é um especialista em tráfego pago e Facebook Ads. Analise os seguintes dados de desempenho de anúncios e forneça uma análise profunda e acionável em português brasileiro.

Dados atuais:
- CPM: ${data.cpm ?? 'N/A'}
- CPC: ${data.cpc ?? 'N/A'}
- CTR: ${data.ctr ?? 'N/A'}
- ROI: ${data.roi ?? 'N/A'}
- Impressões: ${data.impressoes ?? 'N/A'}
- Cliques: ${data.cliques ?? 'N/A'}
- Gasto total: ${data.gastos ?? 'N/A'}

Forneça:
1. Uma análise geral do desempenho (2-3 frases diretas)
2. O maior ponto de atenção nos dados
3. 3 ações práticas e específicas para melhorar os resultados
4. Uma estimativa de como melhorar o ROI

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior ponto de atenção",
  "dicas": ["dica 1", "dica 2", "dica 3"],
  "estimativa": "estimativa de melhoria"
}`,

  whatsapp: (data) => `
Você é um especialista em vendas via WhatsApp e automação de conversas. Analise os dados de conversas e forneça insights em português brasileiro.

Dados atuais:
- Conversas iniciadas: ${data.conversasIniciadas ?? 'N/A'}
- Conversas não concluídas: ${data.conversasNaoTerminadas ?? 'N/A'}
- Leads qualificados: ${data.leadsQualificados ?? 'N/A'}
- Média de conversas por dia: ${data.mediaConversasDia ?? 'N/A'}
- Taxa de resposta: ${data.taxaResposta ?? 'N/A'}

Forneça:
1. Uma análise geral da qualidade das conversas (2-3 frases)
2. O maior gargalo identificado
3. 3 estratégias para aumentar a taxa de conversão do WhatsApp
4. Dica sobre o melhor horário ou abordagem

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior gargalo identificado",
  "dicas": ["estratégia 1", "estratégia 2", "estratégia 3"],
  "estimativa": "impacto esperado das melhorias"
}`,

  hotmart: (data) => `
Você é um especialista em infoprodutos e checkout de vendas digitais. Analise os dados da Hotmart e forneça insights em português brasileiro.

Dados atuais:
- Checkouts iniciados: ${data.checkoutsIniciados ?? 'N/A'}
- Checkouts abandonados: ${data.checkoutsNaoTerminados ?? 'N/A'}
- Pagamentos confirmados: ${data.pagamentosConfirmados ?? 'N/A'}
- Taxa de conversão: ${data.taxaConversaoCheckout ?? 'N/A'}
- Ticket médio: ${data.ticketMedio ?? 'N/A'}
- Faturamento: ${data.faturamento ?? 'N/A'}

Forneça:
1. Uma análise geral do funil de checkout (2-3 frases)
2. O principal motivo de abandono provável
3. 3 táticas para recuperar checkouts abandonados e aumentar conversão
4. Recomendação para aumentar o ticket médio

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "principal problema identificado",
  "dicas": ["tática 1", "tática 2", "tática 3"],
  "estimativa": "potencial de aumento de receita"
}`,

  google: (data) => `
Você é um especialista em Google Ads (Search, Display, Performance Max). Analise os seguintes dados de desempenho e forneça uma análise profunda e acionável em português brasileiro.

Dados atuais:
- CPM: ${data.cpm ?? 'N/A'}
- CPC: ${data.cpc ?? 'N/A'}
- CTR: ${data.ctr ?? 'N/A'}
- ROI: ${data.roi ?? 'N/A'}
- Impressões: ${data.impressoes ?? 'N/A'}
- Cliques: ${data.cliques ?? 'N/A'}
- Gasto total: ${data.gastos ?? 'N/A'}

Forneça:
1. Uma análise geral do desempenho (2-3 frases diretas)
2. O maior ponto de atenção nos dados (Quality Score, palavras-chave, lances)
3. 3 ações práticas e específicas para melhorar resultados no Google Ads
4. Uma estimativa de como melhorar o ROI

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior ponto de atenção",
  "dicas": ["dica 1", "dica 2", "dica 3"],
  "estimativa": "estimativa de melhoria"
}`,

  tiktok: (data) => `
Você é um especialista em TikTok Ads e marketing de vídeo curto. Analise os seguintes dados de desempenho e forneça uma análise profunda e acionável em português brasileiro.

Dados atuais:
- CPM: ${data.cpm ?? 'N/A'}
- CPC: ${data.cpc ?? 'N/A'}
- CTR: ${data.ctr ?? 'N/A'}
- ROI: ${data.roi ?? 'N/A'}
- Impressões: ${data.impressoes ?? 'N/A'}
- Cliques: ${data.cliques ?? 'N/A'}
- Gasto total: ${data.gastos ?? 'N/A'}

Forneça:
1. Uma análise geral do desempenho (2-3 frases diretas)
2. O maior ponto de atenção (criativo, hook, segmentação, frequência)
3. 3 ações práticas para melhorar criativos e performance no TikTok Ads
4. Uma estimativa de como melhorar o ROI

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior ponto de atenção",
  "dicas": ["dica 1", "dica 2", "dica 3"],
  "estimativa": "estimativa de melhoria"
}`,

  kiwify: (data) => `
Você é um especialista em vendas digitais e plataformas de checkout. Analise os dados da Kiwify e forneça insights em português brasileiro.

Dados atuais:
- Vendas confirmadas: ${data.pagamentosConfirmados ?? 'N/A'}
- Checkouts iniciados: ${data.checkoutsIniciados ?? 'N/A'}
- Taxa de conversão: ${data.taxaConversaoCheckout ?? 'N/A'}
- Ticket médio: ${data.ticketMedio ?? 'N/A'}
- Faturamento: ${data.faturamento ?? 'N/A'}

Forneça:
1. Uma análise geral do desempenho (2-3 frases)
2. O maior ponto de melhoria identificado
3. 3 estratégias para aumentar conversão e faturamento na Kiwify
4. Recomendação de produto ou oferta complementar

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior ponto de melhoria",
  "dicas": ["estratégia 1", "estratégia 2", "estratégia 3"],
  "estimativa": "impacto esperado"
}`,

  eduzz: (data) => `
Você é um especialista em vendas digitais e plataformas de infoprodutos. Analise os dados da Eduzz e forneça insights em português brasileiro.

Dados atuais:
- Checkouts iniciados: ${data.checkoutsIniciados ?? 'N/A'}
- Checkouts abandonados: ${data.checkoutsNaoTerminados ?? 'N/A'}
- Pagamentos confirmados: ${data.pagamentosConfirmados ?? 'N/A'}
- Taxa de conversão: ${data.taxaConversaoCheckout ?? 'N/A'}
- Ticket médio: ${data.ticketMedio ?? 'N/A'}
- Faturamento: ${data.faturamento ?? 'N/A'}

Forneça:
1. Uma análise geral do funil de checkout (2-3 frases)
2. O principal gargalo identificado
3. 3 táticas para recuperar abandono e aumentar conversão
4. Recomendação para aumentar o ticket médio

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "principal gargalo identificado",
  "dicas": ["tática 1", "tática 2", "tática 3"],
  "estimativa": "potencial de aumento de receita"
}`,

  monetizze: (data) => `
Você é um especialista em vendas digitais e plataformas de pagamento. Analise os dados da Monetizze e forneça insights em português brasileiro.

Dados atuais:
- Checkouts iniciados: ${data.checkoutsIniciados ?? 'N/A'}
- Checkouts abandonados: ${data.checkoutsNaoTerminados ?? 'N/A'}
- Pagamentos confirmados: ${data.pagamentosConfirmados ?? 'N/A'}
- Taxa de conversão: ${data.taxaConversaoCheckout ?? 'N/A'}
- Ticket médio: ${data.ticketMedio ?? 'N/A'}
- Faturamento: ${data.faturamento ?? 'N/A'}

Forneça:
1. Uma análise geral do funil de vendas (2-3 frases)
2. O maior risco ou gargalo identificado
3. 3 estratégias para melhorar conversão na Monetizze
4. Dica sobre precificação ou oferta

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior risco ou gargalo",
  "dicas": ["estratégia 1", "estratégia 2", "estratégia 3"],
  "estimativa": "impacto esperado das melhorias"
}`,

  stripe: (data) => `
Você é um especialista em pagamentos digitais e métricas de receita. Analise os dados do Stripe e forneça insights em português brasileiro.

Dados atuais:
- Transações: ${data.transactions ?? 'N/A'}
- Faturamento: ${data.revenue ?? 'N/A'}
- Reembolsos: ${data.refunds ?? 'N/A'}
- Taxa de reembolso: ${data.refundRate ?? 'N/A'}

Forneça:
1. Uma análise geral da saúde financeira (2-3 frases)
2. O maior ponto de atenção (taxa de reembolso, inadimplência, chargeback)
3. 3 ações para reduzir reembolsos e aumentar retenção
4. Estimativa de impacto se a taxa de reembolso cair à metade

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior ponto de atenção",
  "dicas": ["ação 1", "ação 2", "ação 3"],
  "estimativa": "impacto esperado"
}`,

  crm: (data) => `
Você é um especialista em CRM, funil de vendas e gestão de leads. Analise os dados abaixo e forneça insights em português brasileiro.

Dados atuais:
- Leads: ${data.leads ?? 'N/A'}
- Oportunidades: ${data.opportunities ?? 'N/A'}
- Conversões: ${data.conversions ?? 'N/A'}
- Taxa de conversão: ${data.conversionRate ?? 'N/A'}

Forneça:
1. Uma análise geral da qualidade do funil (2-3 frases)
2. O maior gargalo entre lead e conversão
3. 3 estratégias para aumentar a taxa de fechamento
4. Estimativa de receita adicional se a conversão melhorar 10%

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior gargalo identificado",
  "dicas": ["estratégia 1", "estratégia 2", "estratégia 3"],
  "estimativa": "impacto esperado"
}`,

  landing: (data) => `
Você é um especialista em landing pages, tráfego pago e otimização de conversão. Analise os dados abaixo e forneça insights em português brasileiro.

Dados atuais:
- Visitantes únicos: ${data.visitantes ?? 'N/A'}
- Sessões: ${data.sessoes ?? 'N/A'}
- PageViews: ${data.pageViews ?? 'N/A'}
- Leads rastreados: ${data.leads ?? 'N/A'}
- Cliques em WhatsApp: ${data.cliquesWhatsapp ?? 'N/A'}
- Cliques em checkout: ${data.cliquesCheckout ?? 'N/A'}
- Scroll até 60% da página: ${data.scroll60 ?? 'N/A'}
- Conversões: ${data.conversoes ?? 'N/A'}
- Taxa de conversão: ${data.taxaConversao ?? 'N/A'}
- Receita atribuída: ${data.receitaFormatada ?? 'N/A'}
- Origem principal: ${data.origemPrincipal ?? 'N/A'}
- Distribuição por origem: ${Array.isArray(data.origens) ? data.origens.map((o: any) => `${o.nome}: ${o.total}`).join(', ') : 'N/A'}

Considere que o scroll e os cliques só existem quando o cliente instalou o tracker na página; se estiverem zerados, isso pode significar ausência de instalação e não falta de engajamento — mencione isso se for o caso.

Forneça:
1. Uma análise do desempenho da página (2-3 frases diretas)
2. O maior ponto de perda entre visita e conversão
3. 3 ações práticas para aumentar a conversão
4. Estimativa de impacto se a taxa de conversão melhorar 20%

Responda em JSON com exatamente este formato:
{
  "resumo": "análise geral em 2-3 frases",
  "atencao": "maior ponto de perda identificado",
  "dicas": ["ação 1", "ação 2", "ação 3"],
  "estimativa": "impacto esperado"
}`,
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`ai:card-insight:${session.user.id}`, 15, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas, aguarde um instante.' }, { status: 429 })
    }

    const access = await checkAiAccess(session.user.id, 'card-insight')
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { cardType, data } = await request.json()

    // Object.hasOwn e não truthiness: `CARD_PROMPTS['constructor']` herda do
    // protótipo e passaria na checagem antiga.
    if (typeof cardType !== 'string' || !Object.hasOwn(CARD_PROMPTS, cardType)) {
      return NextResponse.json({ error: 'Tipo de card inválido' }, { status: 400 })
    }

    // `data` é interpolado no prompt. Sem teto, um payload grande vira centenas
    // de milhares de tokens de entrada.
    if (data !== undefined && JSON.stringify(data).length > 8_000) {
      return NextResponse.json({ error: 'Dados do card muito grandes' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
      return NextResponse.json({
        resumo: 'A Sara.ai não está ativa. Configure a integração de IA para ver análises detalhadas.',
        atencao: 'Sara.ai não configurada.',
        dicas: [
          'Ative a Sara.ai nas configurações da plataforma',
          'Após ativar, análises detalhadas estarão disponíveis em tempo real',
          'A Sara.ai analisa CPM, CPC, CTR, conversões e ticket médio',
        ],
        estimativa: 'Análises em tempo real disponíveis após ativação da Sara.ai.',
      })
    }

    const prompt = CARD_PROMPTS[cardType](data)
    const CARD_MODEL = 'gpt-4o-mini'
    const startedAt = Date.now()

    const completion = await openai.chat.completions.create({
      model: CARD_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Você é a Sara.ai, assistente inteligente oficial da FlowSara. Especialista em marketing digital, funis de vendas, métricas e automações. Sempre responda em português do Brasil de forma clara e acionável. Nunca se identifique como GPT, ChatGPT ou qualquer produto da OpenAI.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    })

    await logAI({
      userId: session.user.id,
      action: 'card-insight',
      model: CARD_MODEL,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
      durationMs: Date.now() - startedAt,
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    let parsed: any = {}
    try { parsed = JSON.parse(raw) } catch { parsed = {} }

    return NextResponse.json({
      resumo: parsed.resumo || '',
      atencao: parsed.atencao || '',
      dicas: parsed.dicas || [],
      estimativa: parsed.estimativa || '',
    })
  } catch (error) {
    console.error('Card insight error:', error)
    return NextResponse.json({ error: 'Erro ao gerar análise' }, { status: 500 })
  }
}
