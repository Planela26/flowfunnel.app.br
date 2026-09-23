import { desdeQuando } from '@/lib/periodo'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'
import { isCanceledSale, extractAmount } from '@/lib/sale-events'
import { produtosDoFunil, eventoDoFunil, vendasDoFunil } from '@/lib/funil-produtos'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// Buscar métricas do Hotmart para o dashboard
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // A chave precisa incluir a janela. Sem isso, "Hoje" e "Últimos 30 dias"
    // compartilhavam a MESMA entrada de cache: trocar o período no dashboard
    // devolvia os números da janela anterior por até dois minutos.
    const dias = new URL(request.url).searchParams.get('days') || '30'
    // O funil ativo no dashboard. Entra na chave de cache junto com a janela —
    // sem isso, trocar de funil devolveria os números do funil anterior, que é
    // a mesma armadilha que o `days` já tinha causado.
    const workspaceId = new URL(request.url).searchParams.get('workspaceId')
    const cacheKey = generateCacheKey(session.user.id, 'hotmart-metrics', { dias, workspaceId })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Buscar integração Hotmart
    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'HOTMART',
        isActive: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        checkoutsIniciados: 0,
        checkoutsNaoTerminados: 0,
        pagamentosConfirmados: 0,
        taxaConversaoCheckout: '0%',
        ticketMedio: 'R$ 0',
        faturamento: 'R$ 0',
        connected: false,
      })
    }

    // Todos os funis do usuário, não `findFirst`. O gravador usa
    // `ensureFunnelWithStages`, que pega o mais ANTIGO; este `findFirst` não
    // tinha `orderBy` nenhum, então os dois podiam olhar para funis diferentes
    // e o card lia um funil vazio enquanto as vendas estavam no outro.
    const funis = await prisma.funnel.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const funnelIds = funis.map((f) => f.id)

    if (funnelIds.length === 0) {
      return NextResponse.json({
        checkoutsIniciados: 0,
        checkoutsNaoTerminados: 0,
        pagamentosConfirmados: 0,
        taxaConversaoCheckout: '0%',
        ticketMedio: 'R$ 0',
        faturamento: 'R$ 0',
        connected: true,
        // Zero aqui não é medição: é a ausência de qualquer evento já recebido.
        // O card usa isso para dizer "aguardando o primeiro evento" em vez de
        // afirmar que não houve vendas.
        aguardandoPrimeiroEvento: true,
      })
    }

    const desde = desdeQuando(request) // janela escolhida no dashboard; 30 dias por padrão
    const naJanela = { funnelId: { in: funnelIds }, timestamp: { gte: desde } }

    // Dois recortes possíveis, e a ordem importa.
    //
    // A ATRIBUIÇÃO vem primeiro porque não custa nada a quem usa: a venda feita
    // por quem clicou no link do funil já sabe de qual funil é. Vincular produto
    // à mão funciona, mas exige saber o ID e lembrar de preencher em cada funil
    // — e foi justamente esse passo esquecido que fez os números vazarem.
    //
    // O produto continua como reforço: se estiver vinculado, a venda precisa
    // passar pelos DOIS filtros. Serve para quem vende produtos diferentes pelo
    // mesmo link, onde só a atribuição não separaria.
    const produtos = await produtosDoFunil(workspaceId, 'hotmart', session.user.id)
    const transacoes = await vendasDoFunil(workspaceId, session.user.id, 'hotmart')

    // O CARIMBO. Com produto vinculado, o evento já chegou sabendo de qual
    // funil é: o porteiro decidiu isso na porta (lib/porteiro-funil.ts) e
    // gravou em `workspaceId`. A pergunta vira uma coluna indexada, e o filtro
    // por metadata — que precisava ler o JSON de cada linha — sai de cena.
    //
    // "sem-funil" é o lugar visível das vendas cujo produto não está em funil
    // nenhum. Elas existem de propósito: nenhuma venda é descartada por falta
    // de vínculo, ela só fica esperando em um lugar onde dá para vê-la.
    const verSemFunil = workspaceId === 'sem-funil'
    const usarCarimbo = verSemFunil || (Boolean(workspaceId) && produtos !== null)
    const porCarimbo = usarCarimbo ? { workspaceId: verSemFunil ? null : workspaceId } : {}

    // A atribuição pelo link continua atendendo o funil que tem link mas ainda
    // não tem produto vinculado. Com carimbo ela é desnecessária: o carimbo já
    // é a resposta, e mais restritivo.
    const porAtribuicao = !usarCarimbo && transacoes !== null ? { transactionId: { in: transacoes } } : {}

    // Com carimbo, o filtro por metadata deixa de valer — ele já foi aplicado
    // na chegada. Passar `null` adiante é o que diz "não filtre de novo".
    const produtosParaFiltrar = usarCarimbo ? null : produtos

    // FUNIL SEM NADA VINCULADO. Antes, ele caía no "sem filtro" e mostrava as
    // vendas da conta INTEIRA — era esta a origem de "os dois funis mostram o
    // mesmo número". Mostrar os números de outro funil é pior do que não
    // mostrar nenhum: o card agora diz que está esperando ser configurado.
    if (workspaceId && !verSemFunil && produtos === null && transacoes === null) {
      const aguardando = {
        checkoutsIniciados: 0,
        checkoutsNaoTerminados: 0,
        checkoutsAguardando: 0,
        pagamentosConfirmados: 0,
        taxaConversaoCheckout: '0%',
        ticketMedio: formatCurrency(0),
        faturamento: formatCurrency(0),
        connected: true,
        aguardandoIntegracoes: true,
        filtroDeProdutos: {
          workspaceId,
          produtos: null,
          porAtribuicao: false,
          vendasAtribuidas: null,
          aplicado: false,
          vendasAntesDoFiltro: 0,
          vendasDepoisDoFiltro: 0,
        },
        raw: { totalSales: 0, totalRevenue: 0, averageTicket: 0 },
      }
      cache.set(cacheKey, aguardando, CacheTTL.SHORT)
      return NextResponse.json(aguardando)
    }

    const lerMeta = (linha: { metadata: string | null }) => {
      try {
        return typeof linha.metadata === 'string' ? JSON.parse(linha.metadata) : linha.metadata
      } catch {
        return {}
      }
    }

    // Com vínculo de produto, contar no banco não serve: o productId vive dentro
    // do JSON de metadata. Busca-se e filtra-se aqui, com a mesma regra que as
    // vendas usam, para os três números saírem do mesmo critério.
    const contarPorTipo = async (eventType: string) => {
      if (!produtosParaFiltrar) {
        return prisma.funnelEvent.count({ where: { ...naJanela, ...porCarimbo, ...porAtribuicao, eventType } })
      }
      const linhas = await prisma.funnelEvent.findMany({
        where: { ...naJanela, ...porCarimbo, ...porAtribuicao, eventType },
        select: { metadata: true },
      })
      return linhas.filter((l) => eventoDoFunil(lerMeta(l), produtosParaFiltrar)).length
    }

    // Boletos/PIX emitidos e ainda não pagos.
    const checkoutsPendentes = await contarPorTipo('hotmart_checkout_started')

    // Carrinhos abandonados — evento PURCHASE_OUT_OF_SHOPPING_CART.
    // Antes, "abandonados" era `checkouts - confirmados`, uma subtração entre
    // grandezas que não se relacionam: dava 0 sempre, e negativo quando havia
    // mais vendas do que boletos.
    const carrinhosAbandonados = await contarPorTipo('hotmart_cart_abandoned')

    // Buscar vendas completas
    const vendasCompletas = await prisma.funnelEvent.findMany({
      where: { ...naJanela, ...porCarimbo, ...porAtribuicao, eventType: 'hotmart_purchase_complete' },
      // Só metadata é lido daqui (lerMeta); as demais colunas vinham de graça
      // e custavam banda a cada carregamento do card.
      select: { metadata: true },
    })

    // `isCanceledSale` é a mesma regra usada em Relatórios, Analytics e no cron
    // de snapshot. A daqui testava só `status !== 'canceled'`, então uma venda
    // REEMBOLSADA (status 'refunded') continuava contando como confirmada e
    // somando faturamento — o card mostrava receita que já tinha voltado.
    // O vínculo de produto entra no mesmo filtro: venda de produto que não é
    // deste funil não conta aqui nem no faturamento.
    const vendasAtivas = vendasCompletas.filter((venda) => {
      const meta = lerMeta(venda)
      return !isCanceledSale(meta) && eventoDoFunil(meta, produtosParaFiltrar)
    })

    const pagamentosConfirmados = vendasAtivas.length

    // AS VENDAS SEM DONO. O "Sem funil" só serve se for visível: uma venda que
    // não entra em funil nenhum some da tela inteira, e a pessoa descobre
    // estranhando o faturamento semanas depois. Aqui ela vira um aviso com os
    // ids prontos para cadastrar.
    //
    // Só é calculado quando há funil aberto — na visão da conta inteira não há
    // nada de que essas vendas estejam "faltando".
    let vendasSemFunil = 0
    let produtosSemFunil: string[] = []
    if (workspaceId && !verSemFunil) {
      const orfas = await prisma.funnelEvent.findMany({
        where: {
          funnelId: { in: funnelIds },
          workspaceId: null,
          timestamp: { gte: desde },
          eventType: 'hotmart_purchase_complete',
        },
        select: { metadata: true },
        take: 5_000,
      })
      const ativas = orfas.filter((o) => !isCanceledSale(lerMeta(o)))
      vendasSemFunil = ativas.length
      produtosSemFunil = [
        ...new Set(
          ativas
            .map((o) => lerMeta(o)?.productId ?? lerMeta(o)?.product_id)
            .filter((id: unknown) => id != null)
            .map((id: unknown) => String(id)),
        ),
      ].slice(0, 5)
    }

    // Calcular faturamento total
    let faturamentoTotal = 0
    vendasAtivas.forEach((venda) => {
      faturamentoTotal += extractAmount(lerMeta(venda))
    })

    // Calcular ticket médio
    const ticketMedio = pagamentosConfirmados > 0
      ? faturamentoTotal / pagamentosConfirmados
      : 0

    // Toda venda confirmada passou por um checkout. Antes, "checkouts" contava
    // apenas boletos pendentes, então uma compra aprovada no cartão deixava o
    // card com Checkouts=0 e Confirmados=1 — e a taxa de conversão em 0%,
    // porque o divisor era zero.
    const checkoutsIniciados = pagamentosConfirmados + checkoutsPendentes + carrinhosAbandonados
    const checkoutsNaoTerminados = carrinhosAbandonados

    // Taxa de conversão de checkout
    const taxaConversao = checkoutsIniciados > 0
      ? (pagamentosConfirmados / checkoutsIniciados) * 100
      : 0

    const response = {
      checkoutsIniciados,
      checkoutsNaoTerminados,
      // PIX/boleto emitidos e ainda não pagos. Estavam sendo somados ao mesmo
      // número dos abandonados, e são coisas opostas: um ainda pode virar
      // venda, o outro já não vira.
      checkoutsAguardando: checkoutsPendentes,
      pagamentosConfirmados,
      taxaConversaoCheckout: `${taxaConversao.toFixed(1)}%`,
      ticketMedio: formatCurrency(ticketMedio),
      faturamento: formatCurrency(faturamentoTotal),
      connected: true,
      // O que o filtro de produto viu. Sem isto, "o card mostra as vendas do
      // outro funil" não tem como ser diagnosticado de fora: as três causas
      // possíveis — vínculo não gravado, workspaceId não recebido, produto sem
      // correspondência — produzem exatamente a mesma tela.
      filtroDeProdutos: {
        workspaceId: workspaceId ?? null,
        // Por carimbo = o porteiro decidiu na chegada (o caminho novo).
        porCarimbo: usarCarimbo,
        produtos,
        // Por atribuição = automático, pelo link. Por produto = manual.
        porAtribuicao: transacoes !== null,
        vendasAtribuidas: transacoes?.length ?? null,
        aplicado: produtos !== null || transacoes !== null,
        vendasAntesDoFiltro: vendasCompletas.length,
        vendasDepoisDoFiltro: pagamentosConfirmados,
      },
      // Nenhum evento Hotmart chegou ainda nesta janela — distinto de "houve
      // movimento e deu zero". O card diferencia os dois.
      aguardandoPrimeiroEvento:
        pagamentosConfirmados === 0 && checkoutsPendentes === 0 && carrinhosAbandonados === 0,
      // Vendas que chegaram e não couberam em funil nenhum, nesta janela.
      vendasSemFunil,
      produtosSemFunil,
      // Dados brutos para cálculos
      raw: {
        totalSales: pagamentosConfirmados,
        totalRevenue: faturamentoTotal,
        averageTicket: ticketMedio,
      },
      data: {
        sales: pagamentosConfirmados,
        revenue: faturamentoTotal,
        checkouts: checkoutsIniciados,
        conversionRate: taxaConversao,
      },
    }

    // Salvar no cache por 2 minutos
    cache.set(cacheKey, response, CacheTTL.MEDIUM)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao buscar métricas Hotmart:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    )
  }
}
