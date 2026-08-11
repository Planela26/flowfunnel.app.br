import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'
import { getMaxFunnels, normalizePlan } from '@/lib/plans'

// Criar novo funil
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { name, description, startDate, endDate } = await request.json()

    // Contar e criar dentro da MESMA transação, com a linha do usuário travada.
    // Antes, `count()` e `create()` eram chamadas separadas: N requisições
    // simultâneas liam o mesmo total antes de qualquer insert e todas passavam,
    // furando o limite do plano. O FOR UPDATE serializa por usuário.
    const outcome = await withTenantTx(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${session.user.id} FOR UPDATE`

      const dbUser = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      })
      const plan = normalizePlan(dbUser?.plan)
      const maxFunnels = getMaxFunnels(plan)

      if (maxFunnels !== -1) {
        const currentCount = await tx.funnel.count({
          where: { userId: session.user.id, isActive: true },
        })
        if (currentCount >= maxFunnels) {
          return { limitReached: true as const, plan, maxFunnels, currentCount }
        }
      }

      const created = await tx.funnel.create({
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
        include: { stages: true },
      })
      return { limitReached: false as const, funnel: created }
    })

    if (outcome.limitReached) {
      return NextResponse.json(
        {
          error: 'plan_limit_reached',
          resource: 'funnels',
          currentPlan: outcome.plan,
          limit: outcome.maxFunnels,
          current: outcome.currentCount,
          message: `Seu plano ${outcome.plan} permite até ${outcome.maxFunnels} funil(is) ativo(s). Faça upgrade para criar mais.`,
          upgradeUrl: '/billing',
        },
        { status: 402 }
      )
    }

    return NextResponse.json({ success: true, funnel: outcome.funnel })
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
