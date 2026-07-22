import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        trialStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        trialPlan: true,
        plan: true,
        emailVerified: true,
        createdAt: true,
      },
    })

    const now = new Date()

    const totalUsers = users.length
    const pendingEmail = users.filter(u => u.trialStatus === 'pending_email').length
    const pendingPayment = users.filter(u => u.trialStatus === 'pending_payment').length
    const activeTrial = users.filter(u => u.trialStatus === 'active').length
    const expiredTrial = users.filter(u => u.trialStatus === 'expired').length
    const convertedTrial = users.filter(u => u.trialStatus === 'converted').length
    const noneTrial = users.filter(u => !u.trialStatus || u.trialStatus === 'none').length

    const trialStartedAt = users.filter(u => u.trialStatus === 'active')
    const activeWithPlan = trialStartedAt.filter(u =>
      u.trialStartedAt && u.trialEndsAt && u.trialEndsAt > now
    ).length

    const trialStartedThisMonth = users.filter(u => {
      if (!u.trialStartedAt) return false
      const d = new Date(u.trialStartedAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    const trialStartedThisWeek = users.filter(u => {
      if (!u.trialStartedAt) return false
      const d = new Date(u.trialStartedAt)
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return d >= weekAgo
    }).length

    const trialStartedToday = users.filter(u => {
      if (!u.trialStartedAt) return false
      const d = new Date(u.trialStartedAt)
      return d.toDateString() === now.toDateString()
    }).length

    const totalTrialsEver = users.filter(u => u.trialStatus && u.trialStatus !== 'none').length
    const conversionRate = totalTrialsEver > 0
      ? Math.round((convertedTrial / totalTrialsEver) * 100)
      : 0

    const usersWhoStartedTrial = users.filter(u => u.trialStartedAt && u.trialStatus === 'active')
    const daysToTrial = usersWhoStartedTrial.map(u => {
      if (!u.trialStartedAt || !u.createdAt) return null
      const diff = new Date(u.trialStartedAt).getTime() - new Date(u.createdAt).getTime()
      return Math.round(diff / (1000 * 60 * 60 * 24))
    }).filter((d): d is number => d !== null)
    const avgDaysToTrial = daysToTrial.length > 0
      ? Math.round(daysToTrial.reduce((a, b) => a + b, 0) / daysToTrial.length)
      : 0

    return NextResponse.json({
      totalUsers,
      pendingEmail,
      pendingPayment,
      activeTrial: activeTrial,
      expiredTrial,
      convertedTrial,
      noneTrial,
      activeWithPlan,
      trialStartedThisMonth,
      trialStartedThisWeek,
      trialStartedToday,
      totalTrialsEver,
      conversionRate,
      avgDaysToTrial,
      emailVerified: users.filter(u => !!u.emailVerified).length,
      emailNotVerified: users.filter(u => !u.emailVerified).length,
    })
  } catch (error) {
    console.error('Erro trial stats:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
