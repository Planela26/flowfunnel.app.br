import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'
import { getMaxFunnels, normalizePlan } from '@/lib/plans'

/**
 * Quais cards um funil mostra, deduzidos do que a pessoa configurou nele.
 *
 * O `id` de cada card em AVAILABLE_INTEGRATIONS é o mesmo nome usado nas
 * fontes ('facebook', 'hotmart', …), então a dedução é direta.
 *
 * Antes, funil novo nascia com `'[]'` — sem card nenhum. A intenção era não
 * herdar os cards do funil anterior, mas o resultado foi pior: quem escolhia a
 * campanha do Meta e o produto da Hotmart na criação abria o funil e via uma
 * tela VAZIA, sem relação com o que tinha acabado de configurar.
 *
 * Só o que foi escolhido entra. Eu havia forçado `landing` aqui achando que um
 * funil sem o topo pareceria quebrado — mas card que aparece sem ter sido
 * pedido é justamente o problema que este arquivo existe para resolver.
 */
function cardsDoFunil(opts: {
  trafficSources?: string[]
  checkoutSources?: string[]
  whatsappIntegrationId?: string | null
}): string[] {
  const ids = new Set<string>()
  for (const t of opts.trafficSources ?? []) ids.add(t)
  if (opts.whatsappIntegrationId) ids.add('whatsapp')
  for (const c of opts.checkoutSources ?? []) ids.add(c)
  return [...ids]
}

// Buscar todos os workspaces do usuário (com dados das integrações)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const workspaces = await prisma.workspace.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })

    // Enriquecer com dados das integrações e campanhas
    const integrations = await prisma.integration.findMany({
      where: { userId: session.user.id, platform: 'WHATSAPP', isActive: true },
    })

    const campaigns = await prisma.campaign.findMany({
      where: { userId: session.user.id, platform: 'META_ADS' },
    })

    const enriched = workspaces.map((ws) => {
      const whatsappIntegration = integrations.find((i) => i.id === ws.whatsappIntegrationId)
      let whatsappNickname = null
      let phoneNumberId = null
      if (whatsappIntegration) {
        whatsappNickname = whatsappIntegration.nickname
        try {
          const c = JSON.parse(whatsappIntegration.config || '{}')
          phoneNumberId = c.phoneNumberId
        } catch {}
      }
      const campaign = campaigns.find((c) => c.campaignId === ws.facebookCampaignId)
      let checkoutSources: string[] = []
      try {
        checkoutSources = JSON.parse(ws.checkoutSources || '[]')
      } catch {}
      // Já desserializado para a tela poder marcar o que está vinculado sem
      // precisar interpretar JSON cru. `{}` quando não há vínculo.
      let checkoutProductIds: Record<string, string[]> = {}
      try {
        checkoutProductIds = ws.checkoutProductIds ? JSON.parse(ws.checkoutProductIds) : {}
      } catch {}
      return {
        ...ws,
        whatsappNickname,
        phoneNumberId,
        facebookCampaignName: campaign?.name ?? null,
        facebookCampaignStatus: campaign?.status ?? null,
        checkoutSources,
        checkoutProductIds,
      }
    })

    return NextResponse.json({ workspaces: enriched })
  } catch (error) {
    console.error('Erro ao buscar workspaces:', error)
    return NextResponse.json({ error: 'Erro ao buscar workspaces' }, { status: 500 })
  }
}

// Criar novo workspace
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { name, emoji, whatsappIntegrationId, facebookCampaignId, checkoutSources, trafficSources, checkoutProductIds } = await request.json()
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    // Limite verificado e workspace criado na MESMA transação, com a linha do
    // usuário travada — sem isso, requisições concorrentes furam o limite.
    const outcome = await withTenantTx(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${session.user.id} FOR UPDATE`

      const user = await tx.user.findUnique({ where: { id: session.user.id }, select: { plan: true } })
      const plan = normalizePlan(user?.plan)
      const limit = getMaxFunnels(plan)
      const count = await tx.workspace.count({ where: { userId: session.user.id } })

      if (limit !== -1 && count >= limit) {
        return { limitReached: true as const, plan, limit, count }
      }

      const created = await tx.workspace.create({
        data: {
          userId: session.user.id,
          name: name.trim(),
          emoji: emoji || '🚀',
          whatsappIntegrationId: whatsappIntegrationId || null,
          facebookCampaignId: facebookCampaignId || null,
          checkoutSources: checkoutSources ? JSON.stringify(checkoutSources) : '["hotmart"]',
          // O vínculo de produto existia SÓ no PATCH. Quem colava o ID na tela
          // de CRIAÇÃO tinha o valor descartado em silêncio pelo POST, e o funil
          // novo nascia sem filtro — mostrando as vendas de todos os produtos,
          // exatamente o que o campo existe para evitar.
          checkoutProductIds:
            checkoutProductIds && Object.keys(checkoutProductIds).length > 0
              ? JSON.stringify(checkoutProductIds)
              : null,
          // Os cards saem do que a pessoa acabou de configurar, não de `null`
          // (que herdaria o arranjo do usuário, com TODOS os cards e os números
          // do funil anterior) nem de `'[]'` (que abria o funil vazio, sem
          // relação com a campanha e o produto escolhidos na criação).
          funnelVisibleIds: JSON.stringify(
            cardsDoFunil({ trafficSources, checkoutSources, whatsappIntegrationId }),
          ),
          isDefault: count === 0,
        },
      })
      return { limitReached: false as const, workspace: created }
    })

    if (outcome.limitReached) {
      return NextResponse.json(
        {
          error: 'plan_limit_reached',
          resource: 'funnels',
          currentPlan: outcome.plan,
          limit: outcome.limit,
          current: outcome.count,
          message: `Seu plano ${outcome.plan} permite até ${outcome.limit} funil(is). Faça upgrade para criar mais.`,
          upgradeUrl: '/billing',
        },
        { status: 402 }
      )
    }

    return NextResponse.json({ workspace: outcome.workspace })
  } catch (error) {
    console.error('Erro ao criar workspace:', error)
    return NextResponse.json({ error: 'Erro ao criar workspace' }, { status: 500 })
  }
}

// Atualizar workspace (PATCH)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id, name, emoji, whatsappIntegrationId, facebookCampaignId, checkoutSources, checkoutProductIds, trafficSources, setDefault } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    // Verificar que o workspace pertence ao usuário
    const existing = await prisma.workspace.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })

    // O que já estava salvo, para a dedução de cards não perder o que esta
    // edição não mencionou. `trafficSources` não é coluna — vive no arranjo de
    // cards — então 'facebook' é o padrão de quem não informou.
    let existingCheckout: string[] = []
    try { existingCheckout = JSON.parse(existing.checkoutSources || '[]') } catch {}
    const existingTraffic: string[] = ['facebook']

    if (setDefault) {
      await prisma.workspace.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      })
    }

    // Funil que está VAZIO se popula ao ser salvo, a partir do que foi
    // configurado nele. Sem isto, quem criou um funil enquanto a versão
    // anterior estava no ar ficaria com uma tela vazia para sempre, sem
    // caminho óbvio de saída. Funil que já tem cards não é tocado: o arranjo
    // é escolha da pessoa e não pode ser sobrescrito por uma edição de nome.
    let visibleIdsDerivados: string | undefined
    if (existing.funnelVisibleIds === '[]') {
      visibleIdsDerivados = JSON.stringify(
        cardsDoFunil({
          trafficSources: trafficSources ?? existingTraffic,
          checkoutSources: checkoutSources ?? existingCheckout,
          whatsappIntegrationId: whatsappIntegrationId ?? existing.whatsappIntegrationId,
        }),
      )
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...(visibleIdsDerivados !== undefined && { funnelVisibleIds: visibleIdsDerivados }),
        ...(name !== undefined && { name: name.trim() }),
        ...(emoji !== undefined && { emoji }),
        ...(whatsappIntegrationId !== undefined && { whatsappIntegrationId }),
        ...(facebookCampaignId !== undefined && { facebookCampaignId }),
        ...(checkoutSources !== undefined && { checkoutSources: JSON.stringify(checkoutSources) }),
        // Quais produtos ESTE funil acompanha, por plataforma. Objeto vazio
        // vira null de propósito: null significa SEM filtro, e é como a
        // pessoa desfaz o vínculo e volta a ver a conta inteira neste funil.
        ...(checkoutProductIds !== undefined && {
          checkoutProductIds:
            checkoutProductIds && Object.keys(checkoutProductIds).length > 0
              ? JSON.stringify(checkoutProductIds)
              : null,
        }),
        ...(setDefault && { isDefault: true }),
      },
    })

    return NextResponse.json({ workspace })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar workspace' }, { status: 500 })
  }
}

// Deletar workspace (DELETE)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const total = await prisma.workspace.count({ where: { userId: session.user.id } })
    if (total <= 1) return NextResponse.json({ error: 'Você precisa ter pelo menos 1 funil.' }, { status: 400 })

    await prisma.workspace.deleteMany({ where: { id, userId: session.user.id } })

    // Se era o padrão, definir o primeiro restante como padrão
    const first = await prisma.workspace.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: 'asc' } })
    if (first && !first.isDefault) {
      await prisma.workspace.update({ where: { id: first.id }, data: { isDefault: true } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar workspace' }, { status: 500 })
  }
}
