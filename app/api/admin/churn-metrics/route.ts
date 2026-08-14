import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { PLAN_PRICES_BRL, getPlanPriceBRL } from '@/lib/plans'

/** Preços com centavos somam com resíduo de ponto flutuante; corta em 2 casas. */
const round2 = (v: number) => Math.round(v * 100) / 100

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        plan: true,
        stripeSubscriptionId: true,
        createdAt: true,
        trialStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        emailVerified: true,
      },
    })

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const payingUsers = users.filter(u => ['START', 'PRO', 'SCALE'].includes(u.plan))
    const freeUsers = users.filter(u => u.plan === 'FREE')

    // MRR = soma dos planos pagos
    const mrr = round2(payingUsers.reduce((acc, u) => acc + getPlanPriceBRL(u.plan), 0))

    // ARR
    const arr = round2(mrr * 12)

    // Churn = usuários que já tiveram assinatura Stripe (pagaram em algum momento)
    // e hoje estão no plano FREE. Quem nunca assinou não conta como churn.
    const churnedUsers = users.filter(u => !!u.stripeSubscriptionId && u.plan === 'FREE')
    const everPaidCount = payingUsers.length + churnedUsers.length
    const churnRate = everPaidCount > 0
      ? Math.round((churnedUsers.length / everPaidCount) * 100)
      : 0

    // Monthly signups
    const thisMonth = users.filter(u => {
      const d = new Date(u.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    const lastMonth = users.filter(u => {
      const d = new Date(u.createdAt)
      const lastMonthDate = new Date(now)
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
      return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear()
    }).length

    const signupGrowth = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : 0

    // Trial conversion
    const usersWhoStartedTrial = users.filter(u =>
      u.trialStatus && u.trialStatus !== 'none' && u.trialStatus !== 'pending_email' && u.trialStatus !== 'pending_payment'
    ).length
    const convertedFromTrial = users.filter(u => u.trialStatus === 'converted').length
    const trialConversionRate = usersWhoStartedTrial > 0
      ? Math.round((convertedFromTrial / usersWhoStartedTrial) * 100)
      : 0

    // Paying vs total
    const payingRatio = users.length > 0
      ? Math.round((payingUsers.length / users.length) * 100)
      : 0

    // Email verification rate
    const verifiedRate = users.length > 0
      ? Math.round((users.filter(u => !!u.emailVerified).length / users.length) * 100)
      : 0

    // Active trials
    const activeTrials = users.filter(u => u.trialStatus === 'active').length

    // Monthly revenue by plan
    const revenueByPlan = {
      START: round2(users.filter(u => u.plan === 'START').length * PLAN_PRICES_BRL.START),
      PRO: round2(users.filter(u => u.plan === 'PRO').length * PLAN_PRICES_BRL.PRO),
      SCALE: round2(users.filter(u => u.plan === 'SCALE').length * PLAN_PRICES_BRL.SCALE),
    }

    return NextResponse.json({
      mrr,
      arr,
      churnRate,
      totalUsers: users.length,
      payingUsers: payingUsers.length,
      freeUsers: freeUsers.length,
      payingRatio,
      verifiedRate,
      activeTrials,
      trialConversionRate,
      thisMonthSignups: thisMonth,
      lastMonthSignups: lastMonth,
      signupGrowth,
      revenueByPlan,
    })
  } catch (error) {
    console.error('Erro churn metrics:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
