import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

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
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { cardType, data } = await request.json()

    if (!cardType || !CARD_PROMPTS[cardType]) {
      return NextResponse.json({ error: 'Tipo de card inválido' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
      return NextResponse.json({
        resumo: 'Conecte sua chave OpenAI para ver análises detalhadas com IA.',
        atencao: 'API Key não configurada.',
        dicas: [
          'Configure a OPENAI_API_KEY nas configurações',
          'Após configurar, análises detalhadas estarão disponíveis',
          'A IA analisa CPM, CPC, CTR, conversões e ticket médio',
        ],
        estimativa: 'Análises em tempo real disponíveis após configuração.',
      })
    }

    const prompt = CARD_PROMPTS[cardType](data)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
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
