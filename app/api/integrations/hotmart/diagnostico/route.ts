import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureWebhookToken, buildWebhookUrl } from '@/lib/webhook-tenant'
import { motivoDaPausaDeIngestao } from '@/lib/account-status'

/**
 * Diagnóstico da integração Hotmart — por que a venda não apareceu no card.
 *
 * Existe porque descobrir isso exigia acesso ao banco de produção e ao painel
 * da Hotmart ao mesmo tempo. Uma venda que não aparecia podia ser: URL errada
 * no painel, hottok divergente, evento não marcado, ingestão pausada por conta
 * vencida, ou simplesmente webhook configurado depois da compra. Cada uma tem
 * uma correção diferente, e nenhuma delas deixava rastro visível.
 *
 * Somente leitura. Não devolve o hottok nem nenhum outro segredo — apenas se
 * está configurado e o tamanho, que é o suficiente para comparar com o que
 * está na Hotmart sem transportar o valor.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const integration = await prisma.integration.findFirst({
      where: { userId, platform: 'HOTMART', isActive: true },
    })

    if (!integration) {
      return NextResponse.json({
        conectada: false,
        veredito: 'A integração Hotmart não está conectada. Vá em Configurações → Hotmart e conecte antes de configurar o webhook no painel da Hotmart.',
      })
    }

    let config: Record<string, any> = {}
    try {
      config = typeof integration.config === 'string' ? JSON.parse(integration.config) : {}
    } catch { config = {} }

    const token = await ensureWebhookToken(integration.id)
    const webhookUrl = buildWebhookUrl('HOTMART', token)
    // `buildWebhookUrl` cai para string vazia quando NEXT_PUBLIC_APP_URL não
    // está definida no servidor, e a URL sai como caminho relativo — que a
    // Hotmart não consegue chamar. A tela que mostra a URL aceitava isso como
    // válida porque só testava se era truthy.
    const urlTemDominio = /^https?:\/\//.test(webhookUrl)

    const pausa = await motivoDaPausaDeIngestao(userId)

    const entregas = await prisma.webhookLog.findMany({
      where: { userId, platform: 'HOTMART' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { event: true, statusCode: true, endpoint: true, error: true, response: true, payload: true, createdAt: true },
    })

    // De onde veio (ou não veio) o valor da última venda. A Hotmart 2.0.0 manda
    // três objetos de preço e nenhum é garantido; quando nenhum vem preenchido,
    // a venda entra com faturamento zero e não havia como conferir o porquê —
    // o payload original não fica guardado em lugar nenhum permanente.
    const ultimaVenda = entregas.find(
      (e) => e.statusCode < 400 && ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'].includes(e.event),
    )
    const precosRecebidos = (() => {
      if (!ultimaVenda?.payload) return null
      try {
        const p = JSON.parse(ultimaVenda.payload)?.data?.purchase
        return {
          quando: ultimaVenda.createdAt,
          evento: ultimaVenda.event,
          price: p?.price?.value ?? null,
          full_price: p?.full_price?.value ?? null,
          original_offer_price: p?.original_offer_price?.value ?? null,
          moeda: p?.price?.currency_value ?? p?.full_price?.currency_value ?? null,
        }
      } catch {
        return null
      }
    })()

    const funis = await prisma.funnel.findMany({ where: { userId }, select: { id: true } })
    const funnelIds = funis.map((f) => f.id)

    const contar = (eventType: string) =>
      funnelIds.length
        ? prisma.funnelEvent.count({ where: { funnelId: { in: funnelIds }, eventType } })
        : Promise.resolve(0)

    const [vendas, pendentes, abandonos] = await Promise.all([
      contar('hotmart_purchase_complete'),
      contar('hotmart_checkout_started'),
      contar('hotmart_cart_abandoned'),
    ])

    const ultimoEvento = funnelIds.length
      ? await prisma.funnelEvent.findFirst({
          where: { funnelId: { in: funnelIds }, source: 'hotmart' },
          orderBy: { timestamp: 'desc' },
          select: { eventType: true, timestamp: true },
        })
      : null

    return NextResponse.json({
      conectada: true,
      integracao: {
        hotmartId: config.hotmartId ?? null,
        conectadaEm: config.connectedAt ?? integration.createdAt,
        // O valor NUNCA sai daqui. O tamanho basta para conferir contra o que
        // está na Hotmart sem transportar o segredo.
        hottokConfigurado: Boolean(integration.accessToken),
        hottokTamanho: integration.accessToken?.length ?? 0,
      },
      webhook: {
        url: webhookUrl,
        urlTemDominio,
      },
      ingestao: {
        pausada: pausa !== null,
        motivo: pausa,
      },
      entregas: entregas.map((e) => ({
        quando: e.createdAt,
        evento: e.event,
        status: e.statusCode,
        // A partir de 5e49724 a resposta carrega `ingerido`. Entregas
        // anteriores não têm o campo — daí o `null`, que significa
        // "desconhecido", não "não ingerido".
        ingerido: leIngerido(e.response),
        erro: e.error,
      })),
      eventosGravados: { vendas, pendentes, abandonos, ultimoEvento },
      precosRecebidos,
      veredito: veredito({
        urlTemDominio,
        pausa,
        entregas: entregas.length,
        entregasComErro: entregas.filter((e) => e.statusCode >= 400).length,
        vendas,
        eventos: vendas + pendentes + abandonos,
        precoZerado:
          precosRecebidos != null &&
          !precosRecebidos.price &&
          !precosRecebidos.full_price &&
          !precosRecebidos.original_offer_price,
      }),
    })
  } catch (error) {
    console.error('Erro no diagnóstico Hotmart:', error)
    return NextResponse.json({ error: 'Erro ao gerar diagnóstico' }, { status: 500 })
  }
}

function leIngerido(response: string | null): boolean | null {
  if (!response) return null
  try {
    const r = JSON.parse(response)
    return typeof r?.ingerido === 'boolean' ? r.ingerido : null
  } catch {
    return null
  }
}

/**
 * A conclusão em português. É o campo que importa: o resto são os dados que a
 * sustentam, para quem quiser conferir.
 */
function veredito(f: {
  urlTemDominio: boolean
  pausa: string | null
  entregas: number
  entregasComErro: number
  vendas: number
  eventos: number
  precoZerado?: boolean
}): string {
  if (!f.urlTemDominio) {
    return 'A URL do webhook está saindo sem domínio (NEXT_PUBLIC_APP_URL não está definida no servidor). A Hotmart não consegue chamar um caminho relativo. Corrija a variável no servidor e reconfigure a URL no painel da Hotmart.'
  }
  if (f.pausa) {
    const porque = {
      plano_vencido: 'o período pago venceu',
      assinatura_inativa: 'a assinatura está inativa',
      teste_expirado: 'o teste grátis expirou',
    }[f.pausa] ?? f.pausa
    return `A ingestão está PAUSADA porque ${porque}. As entregas da Hotmart chegam e são descartadas — por isso o card fica zerado mesmo com o webhook certo. Renove o plano para voltar a receber.`
  }
  if (f.entregas === 0) {
    return 'Nenhuma entrega da Hotmart chegou até agora. Ou a URL configurada no painel da Hotmart não é a que está acima, ou os eventos PURCHASE_APPROVED e PURCHASE_COMPLETE não estão marcados na configuração. Lembre também que webhook não é retroativo: compras feitas antes de configurar não são reenviadas.'
  }
  if (f.entregasComErro > 0 && f.eventos === 0) {
    return `Chegaram ${f.entregas} entregas e ${f.entregasComErro} foram recusadas. Recusa com 403 significa que o Hottok gravado aqui é diferente do que está na Hotmart — compare os dois e salve de novo em Configurações → Hotmart.`
  }
  if (f.eventos === 0) {
    return `Chegaram ${f.entregas} entregas, todas aceitas, mas nenhuma virou evento. Provavelmente são eventos que não registram venda (troca de plano, por exemplo). Marque PURCHASE_APPROVED e PURCHASE_COMPLETE na configuração da Hotmart.`
  }
  if (f.vendas === 0) {
    return `Há ${f.eventos} eventos gravados, mas nenhuma venda confirmada. Só boletos pendentes ou carrinhos abandonados chegaram até agora.`
  }
  if (f.precoZerado) {
    return `A venda foi registrada, mas a Hotmart mandou o payload SEM valor: price, full_price e original_offer_price vieram todos vazios (veja "precosRecebidos" abaixo). Por isso o faturamento aparece zerado. Isso é típico de evento de teste/simulador; numa venda real esses campos vêm preenchidos.`
  }
  return `Funcionando: ${f.vendas} venda(s) confirmada(s) gravada(s). Se o card ainda mostra zero, confira o período selecionado no dashboard e recarregue — a resposta fica em cache por 2 minutos.`
}
