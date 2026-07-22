import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMaxFunnels, normalizePlan } from '@/lib/plans'

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
      return {
        ...ws,
        whatsappNickname,
        phoneNumberId,
        facebookCampaignName: campaign?.name ?? null,
        facebookCampaignStatus: campaign?.status ?? null,
        checkoutSources,
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

    const { name, emoji, whatsappIntegrationId, facebookCampaignId, checkoutSources } = await request.json()
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    // Verificar limite por plano (centralizado em lib/plans.ts → PLAN_FUNNEL_LIMITS)
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } })
    const plan = normalizePlan(user?.plan)
    const limit = getMaxFunnels(plan)
    const count = await prisma.workspace.count({ where: { userId: session.user.id } })
    if (limit !== -1 && count >= limit) {
      return NextResponse.json(
        {
          error: 'plan_limit_reached',
          resource: 'funnels',
          currentPlan: plan,
          limit,
          current: count,
          message: `Seu plano ${plan} permite até ${limit} funil(is). Faça upgrade para criar mais.`,
          upgradeUrl: '/billing',
        },
        { status: 402 }
      )
    }

    const isFirst = count === 0
    const workspace = await prisma.workspace.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        emoji: emoji || '🚀',
        whatsappIntegrationId: whatsappIntegrationId || null,
        facebookCampaignId: facebookCampaignId || null,
        checkoutSources: checkoutSources ? JSON.stringify(checkoutSources) : '["hotmart"]',
        isDefault: isFirst,
      },
    })

    return NextResponse.json({ workspace })
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

    const { id, name, emoji, whatsappIntegrationId, facebookCampaignId, checkoutSources, setDefault } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    // Verificar que o workspace pertence ao usuário
    const existing = await prisma.workspace.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })

    if (setDefault) {
      await prisma.workspace.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      })
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(emoji !== undefined && { emoji }),
        ...(whatsappIntegrationId !== undefined && { whatsappIntegrationId }),
        ...(facebookCampaignId !== undefined && { facebookCampaignId }),
        ...(checkoutSources !== undefined && { checkoutSources: JSON.stringify(checkoutSources) }),
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
