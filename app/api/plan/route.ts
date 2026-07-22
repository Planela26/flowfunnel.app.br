import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanFeatures, getHistoryLimitDays, getPlanLimit, isUnlimited, normalizePlan, PLAN_LABELS } from '@/lib/plans'
import { getEffectivePlan, isTrialActive, isTrialExpired, isPendingPayment, isPendingEmail, trialDaysLeft } from '@/lib/trial'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, role: true, trialEndsAt: true, trialPlan: true, trialStatus: true },
  })

  const effectivePlan = getEffectivePlan(u ?? { plan: 'FREE' })
  const onTrial = isTrialActive(u ?? { plan: 'FREE' })
  const trialExpired = isTrialExpired(u ?? { plan: 'FREE' })
  const daysLeft = trialDaysLeft(u?.trialEndsAt)

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
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  )
}
