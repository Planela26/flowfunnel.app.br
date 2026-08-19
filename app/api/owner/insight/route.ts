import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { canAccessOwnerFunnel } from '@/lib/owner-funnel'
import { checkRateLimit } from '@/lib/security-utils'

/**
 * Análise da Sara sobre o funil PRÓPRIO do FlowSara.
 *
 * Rota separada de /api/ai/card-insight de propósito: aquela analisa um card
 * isolado (só WhatsApp, só Hotmart), enquanto esta recebe a cadeia inteira —
 * degraus, taxas de passagem, comparação com o período anterior, custo de
 * anúncio e receita por criativo. A pergunta é outra: não "como está o
 * WhatsApp", e sim "onde o dinheiro está sendo perdido no caminho".
 */

// `|| 'demo-mode'` porque o SDK lança na CONSTRUÇÃO quando não recebe chave —
// e isso acontece ao carregar o módulo, antes de qualquer checagem. Sem o
// valor de reserva, a rota inteira quebrava com 500 em ambiente sem IA
// configurada, e o caminho de contingência logo abaixo nunca era alcançado.
// Mesmo padrão de app/api/ai/card-insight/route.ts.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'demo-mode' })

function montarPrompt(d: any): string {
  const passos = (d.passos || [])
    .map((p: any, i: number) => `  ${i + 1}. ${p.rotulo}: ${p.total}${p.taxaDoAnterior ? ` (${p.taxaDoAnterior} do degrau anterior)` : ''}`)
    .join('\n')

  const comp = d.comparacao
    ? Object.entries(d.comparacao)
        .filter(([k]) => k !== 'diasComparados')
        .map(([k, v]: [string, any]) => `  ${k}: ${v.atual} agora vs ${v.anterior} antes (${v.variacao})`)
        .join('\n')
    : '  sem dados do período anterior'

  const campanhas = (d.campanhas || []).slice(0, 5)
    .map((c: any) => `  ${c.nome}: ${c.vendas} venda(s), R$ ${c.receita.toFixed(2)}`)
    .join('\n') || '  nenhuma venda atribuída'

  const anuncios = (d.anuncios || []).slice(0, 5)
    .map((a: any) => `  ${a.adId}: ${a.vendas} venda(s), R$ ${a.receita.toFixed(2)}`)
    .join('\n') || '  nenhuma venda atribuída a criativo'

  const custo = d.custo?.investimento != null
    ? `Investimento: ${d.custo.investimentoFormatado}\nCAC: ${d.custo.cac}\nCPA: ${d.custo.cpa}\nROAS: ${d.custo.roas}\nROI: ${d.custo.roi}\nLucro: ${d.custo.lucro}`
    : 'Conta de anúncios NÃO conectada — não há dado de investimento, então CAC, ROAS e ROI são desconhecidos.'

  const anuncioMeta = d.meta
    ? `CTR: ${d.meta.ctr} | CPC: ${d.meta.cpc} | CPM: ${d.meta.cpm} | Impressões: ${d.meta.impressoes}`
    : 'Conta de anúncios não conectada — CTR, CPC e CPM desconhecidos.'

  // A divergência entre o clique que a Meta cobra e a visita que registramos é
  // um degrau ANTES do funil: se o dinheiro se perde aí, otimizar a landing não
  // resolve nada. Por isso vai no prompt separado, não misturado aos degraus.
  const divergencia = d.divergencia
    ? `A Meta contabilizou ${d.divergencia.cliques} clique(s) no link; o FlowSara registrou ${d.divergencia.registrados} visitante(s) vindos da Meta (${d.divergencia.captura.toFixed(1)}% capturado). ${d.divergencia.naoChegaram} clique(s) pagos não viraram visita.`
    : 'Sem dado de cliques da Meta para comparar.'

  return `
Você é um especialista em tráfego pago e otimização de funil. Analise o funil do FlowSara (um SaaS de rastreamento de vendas que vende assinaturas de R$ 47,90 a R$ 147,90/mês) e responda em português brasileiro.

PERÍODO: últimos ${d.periodoDias} dias, comparado com os ${d.periodoDias} dias anteriores.

FUNIL (cada degrau e a taxa de quem passou do anterior):
${passos}

GARGALO IDENTIFICADO: ${d.gargalo ? `${d.gargalo.de} → ${d.gargalo.para}, apenas ${d.gargalo.taxaFormatada} de passagem (${d.gargalo.perdidos} pessoas perdidas)` : 'não identificado'}

COMPARAÇÃO COM O PERÍODO ANTERIOR:
${comp}

CUSTO E RETORNO:
${custo}

DESEMPENHO DO ANÚNCIO NA META:
${anuncioMeta}

PERDA ENTRE O CLIQUE E A VISITA:
${divergencia}

RECEITA POR CAMPANHA:
${campanhas}

RECEITA POR CRIATIVO (id do anúncio):
${anuncios}

Receita total: ${d.receitaFormatada}
Ticket médio: ${d.ticketMedioFormatado}
Conversão final (visita → compra): ${d.taxaConversaoFinal}

INSTRUÇÕES IMPORTANTES:
- Seja direto e específico. Cite os números do funil acima.
- NÃO invente dados que não estão aqui. Se algo é desconhecido, diga que é desconhecido.
- Se a conta de anúncios não estiver conectada, deixe claro que CAC e ROAS não podem ser avaliados e que conectar é o próximo passo.
- Se houver poucos dados (menos de 20 visitas ou menos de 3 vendas), diga que a amostra é pequena e que as conclusões são preliminares.
- Considere que "Engajamento" mede quem passou de 50% da página, e que "Pagamento iniciado" inclui Pix gerado — Pix gerado NÃO é venda.
- Ao comparar campanhas ou criativos, considere que receita alta com poucas vendas pode ser ruído.
- Se a captura entre clique e visita estiver abaixo de 80%, trate isso como prioridade acima de qualquer ajuste na landing: é dinheiro pago por clique que nunca chegou a ver a página. Abaixo de 50%, cite explicitamente como o problema número um.
- CTR baixo é problema de criativo e público; CPC alto com CTR bom é problema de concorrência no leilão. Não confunda os dois.

Responda em JSON com exatamente este formato:
{
  "resumo": "leitura geral do funil em 2-3 frases, citando números",
  "gargalo": "onde está a maior perda e a provável causa, em 1-2 frases",
  "dicas": ["ação específica 1", "ação específica 2", "ação específica 3"],
  "campanha": "qual campanha ou criativo está performando melhor e o que fazer com isso",
  "estimativa": "o que esperar se o gargalo principal for corrigido"
}`
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const autorizado = await canAccessOwnerFunnel(session?.user as any)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Cada análise custa tokens. O laboratório é de uso pessoal e infrequente,
  // então um teto baixo basta e evita gasto acidental por recarregar a tela.
  const rl = await checkRateLimit(`owner:insight:${(session!.user as any).id}`, 10, 60 * 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Limite de análises por hora atingido.' }, { status: 429 })
  }

  const dados = await request.json().catch(() => null)
  if (!dados) return NextResponse.json({ error: 'Dados ausentes' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
    return NextResponse.json({
      resumo: 'A Sara.ai não está configurada neste ambiente. Os números do funil acima são reais; a leitura automática exige a chave de IA.',
      gargalo: d0(dados),
      dicas: [
        'Configure a OPENAI_API_KEY para receber a análise automática',
        'Enquanto isso, o degrau com menor taxa de passagem é o ponto a atacar',
        'Compare o período atual com o anterior para saber se piorou ou melhorou',
      ],
      campanha: 'Análise por campanha disponível após configurar a Sara.ai.',
      estimativa: '—',
      semIA: true,
    })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: montarPrompt(dados) }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 900,
    })

    const bruto = completion.choices[0]?.message?.content
    if (!bruto) throw new Error('resposta vazia')

    return NextResponse.json(JSON.parse(bruto))
  } catch (e) {
    console.error('[owner/insight]', e)
    return NextResponse.json({ error: 'Não foi possível gerar a análise agora.' }, { status: 500 })
  }
}

/** Descrição do gargalo sem IA — o dado já está calculado, só falta a leitura. */
function d0(dados: any): string {
  const g = dados?.gargalo
  if (!g) return 'Sem dados suficientes para identificar o gargalo.'
  return `Maior perda entre ${g.de} e ${g.para}: apenas ${g.taxaFormatada} avançam (${g.perdidos} pessoas perdidas).`
}
