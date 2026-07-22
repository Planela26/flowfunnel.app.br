import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin } from '@/lib/prisma'
import { isInGracePeriod, isSubscriptionBlocked, graceDaysLeft } from '@/lib/subscription'
import { isTrialExpiredForToken } from '@/lib/auth-trial'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const user = await prismaAdmin.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionStatus: true,
      gracePeriodEndsAt: true,
      trialStatus: true,
      trialEndsAt: true,
      trialPlan: true,
      plan: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const blocked = isSubscriptionBlocked(user.subscriptionStatus, user.gracePeriodEndsAt)
  const inGracePeriod = isInGracePeriod(user.subscriptionStatus, user.gracePeriodEndsAt)
  const daysLeft = graceDaysLeft(user.gracePeriodEndsAt)
  const trialExpired = isTrialExpiredForToken(user)

  // Conta vencida = teste grátis expirado OU assinatura paga inativa.
  // Usado pelo aviso discreto (modo somente leitura) — a entrada de novos dados
  // é interrompida, mas a navegação e os dados existentes continuam acessíveis.
  const expired = blocked || trialExpired

  return NextResponse.json({
    subscriptionStatus: user.subscriptionStatus,
    blocked,
    inGracePeriod,
    graceDaysLeft: inGracePeriod ? daysLeft : null,
    gracePeriodEndsAt: user.gracePeriodEndsAt,
    trialExpired,
    trialPlan: user.trialPlan ?? null,
    expired,
  })
}
