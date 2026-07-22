import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMaxFunnels, normalizePlan } from '@/lib/plans'

// Criar novo funil
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { name, description, startDate, endDate } = await request.json()

    // Enforce limite de funis por plano
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    const plan = normalizePlan(dbUser?.plan)
    const maxFunnels = getMaxFunnels(plan)
    if (maxFunnels !== -1) {
      const currentCount = await prisma.funnel.count({
        where: { userId: session.user.id, isActive: true },
      })
      if (currentCount >= maxFunnels) {
        return NextResponse.json(
          {
            error: 'plan_limit_reached',
            resource: 'funnels',
            currentPlan: plan,
            limit: maxFunnels,
            current: currentCount,
            message: `Seu plano ${plan} permite até ${maxFunnels} funil(is) ativo(s). Faça upgrade para criar mais.`,
            upgradeUrl: '/billing',
          },
          { status: 402 }
        )
      }
    }

    const funnel = await prisma.funnel.create({
      data: {
        userId: session.user.id,
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
        stages: {
          create: [
            { name: 'Clique no Anúncio', order: 1 },
            { name: 'Abriu WhatsApp', order: 2 },
            { name: 'Primeira Mensagem', order: 3 },
            { name: 'Conversa Qualificada', order: 4 },
            { name: 'Pediu Link', order: 5 },
            { name: 'Checkout Iniciado', order: 6 },
            { name: 'Pagamento Aprovado', order: 7 },
          ],
        },
      },
      include: {
        stages: true,
      },
    })

    return NextResponse.json({ success: true, funnel })
  } catch (error) {
    console.error('Erro ao criar funil:', error)
    return NextResponse.json(
      { error: 'Erro ao criar funil' },
      { status: 500 }
    )
  }
}

// Listar funis do usuário
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const funnels = await prisma.funnel.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        stages: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            events: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ success: true, funnels })
  } catch (error) {
    console.error('Erro ao buscar funis:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar funis' },
      { status: 500 }
    )
  }
}
