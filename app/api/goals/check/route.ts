import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendGoalCompletedEmail } from '@/lib/email'

// Verificar e atualizar progresso das metas
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const metrics = body?.metrics ?? {}

    // Buscar metas ativas do usuário
    const activeGoals = await prisma.goal.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        isCompleted: false,
      },
      include: {
        user: true,
      },
    })

    const completedGoals = []

    for (const goal of activeGoals) {
      let currentValue = 0

      // Calcular valor atual baseado na métrica
      switch (goal.metric) {
        case 'sales':
          currentValue = metrics.hotmart?.vendas || 0
          break
        case 'revenue':
          currentValue = metrics.hotmart?.receita || 0
          break
        case 'leads':
          currentValue = metrics.whatsapp?.conversas || 0
          break
        case 'conversions':
          currentValue = metrics.hotmart?.vendas || 0
          break
        case 'clicks':
          currentValue = metrics.facebook?.cliques || 0
          break
      }

      // Atualizar valor atual
      await prisma.goal.update({
        where: { id: goal.id },
        data: { currentValue },
      })

      // Verificar se atingiu a meta
      if (currentValue >= goal.targetValue && !goal.notified) {
        await prisma.goal.update({
          where: { id: goal.id },
          data: {
            isCompleted: true,
            completedAt: new Date(),
            notified: true,
          },
        })

        // Criar notificação no sistema
        await prisma.notification.create({
          data: {
            userId: goal.user.id,
            type: 'goal_completed',
            title: `🎯 Meta Atingida: ${goal.title}`,
            message: `Parabéns! Você alcançou ${goal.targetValue.toLocaleString('pt-BR')} ${goal.metric}!`,
            link: '/dashboard',
          },
        })

        // Enviar email de notificação
        await sendGoalCompletedEmail(
          goal.user.email,
          goal.user.name || 'Usuário',
          goal.title,
          goal.targetValue,
          goal.metric
        )

        completedGoals.push(goal)
      }
    }

    return NextResponse.json({
      success: true,
      checked: activeGoals.length,
      completed: completedGoals.length,
      completedGoals: completedGoals.map((g) => ({
        id: g.id,
        title: g.title,
        targetValue: g.targetValue,
      })),
    })
  } catch (error) {
    console.error('Erro ao verificar metas:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar metas' },
      { status: 500 }
    )
  }
}
