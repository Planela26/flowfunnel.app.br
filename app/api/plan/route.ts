import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanFeatures, getHistoryLimitDays, getPlanLimit, isUnlimited, normalizePlan, PLAN_LABELS } from '@/lib/plans'
import { getEffectivePlan, hasPaidAccess, isTrialActive, isTrialExpired, isPendingPayment, isPendingEmail, trialDaysLeft } from '@/lib/trial'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      role: true,
      trialEndsAt: true,
      trialPlan: true,
      trialStatus: true,
      trialPromptSeenAt: true,
      subscriptionStatus: true,
      paymentMethodAddedAt: true,
      gracePeriodEndsAt: true,
    },
  })

  const effectivePlan = getEffectivePlan(u ?? { plan: 'FREE' })
  const onTrial = isTrialActive(u ?? { plan: 'FREE' })
  const trialExpired = isTrialExpired(u ?? { plan: 'FREE' })
  const daysLeft = trialDaysLeft(u?.trialEndsAt)
  const cardAdded = Boolean(u?.paymentMethodAddedAt)
  const paidAccess = hasPaidAccess({
    subscriptionStatus: u?.subscriptionStatus,
    paymentMethodAddedAt: u?.paymentMethodAddedAt,
    trialStatus: u?.trialStatus,
    trialEndsAt: u?.trialEndsAt,
    trialPlan: u?.trialPlan,
    plan: u?.plan,
    gracePeriodEndsAt: u?.gracePeriodEndsAt,
  })
  // Modo explorar — sem cartão E sem assinatura. Pode usar o funil, mas sem criar integrações reais.
  const exploringOnly = !paidAccess

  return NextResponse.json(
    {
      plan: effectivePlan,
      label: PLAN_LABELS[effectivePlan],
      role: u?.role || 'PRODUTOR',
      limit: getPlanLimit(effectivePlan),
      unlimited: isUnlimited(effectivePlan),
      historyDays: getHistoryLimitDays(effectivePlan),
      features: getPlanFeatures(effectivePlan),
      trialActive: onTrial,
      trialExpired,
      trialDaysLeft: daysLeft,
      trialPlan: u?.trialPlan ?? null,
      trialEndsAt: u?.trialEndsAt?.toISOString() ?? null,
      trialStatus: u?.trialStatus ?? 'none',
      trialPendingPayment: isPendingPayment(u ?? { plan: 'FREE' }),
      trialPendingEmail: isPendingEmail(u ?? { plan: 'FREE' }),
      trialPromptSeenAt: u?.trialPromptSeenAt?.toISOString() ?? null,
      cardAdded,
      paidAccess,
      exploringOnly,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  )
}
