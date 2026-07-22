import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { getPlanPriceBRL } from '@/lib/plans'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        createdAt: true,
        stripeSubscriptionId: true,
        emailVerified: true,
        trialStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        trialPlan: true,
        _count: {
          select: {
            integrations: true,
            webhookLogs: true,
          },
        },
      },
    })

    const stats = {
      total: users.length,
      byPlan: {
        FREE:  users.filter(u => u.plan === 'FREE').length,
        START: users.filter(u => u.plan === 'START').length,
        PRO:   users.filter(u => u.plan === 'PRO').length,
        SCALE: users.filter(u => u.plan === 'SCALE').length,
      },
      mrr: users.reduce((acc, u) => acc + getPlanPriceBRL(u.plan), 0),
    }

    return NextResponse.json({ users, stats })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
