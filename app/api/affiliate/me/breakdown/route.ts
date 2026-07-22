import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })

  const sales = await prisma.affiliateSale.findMany({
    where: { affiliateId: affiliate.id },
    select: { plan: true, commissionAmount: true, discountedAmount: true, originalAmount: true },
  })

  const byPlan: Record<string, { count: number; commission: number; revenue: number; originalAmount: number }> = {}

  for (const s of sales) {
    const plan = s.plan || 'OUTRO'
    if (!byPlan[plan]) {
      byPlan[plan] = { count: 0, commission: 0, revenue: 0, originalAmount: 0 }
    }
    byPlan[plan].count++
    byPlan[plan].commission += s.commissionAmount
    byPlan[plan].revenue += s.discountedAmount
    byPlan[plan].originalAmount += s.originalAmount
  }

  const totalClicks = await prisma.affiliateClick.count({
    where: { affiliateId: affiliate.id },
  })

  const totalSales = sales.length
  const totalCommission = sales.reduce((s, v) => s + v.commissionAmount, 0)
  const totalRevenue = sales.reduce((s, v) => s + v.discountedAmount, 0)
  const totalOriginalAmount = sales.reduce((s, v) => s + v.originalAmount, 0)

  const conversionRate = totalClicks > 0 ? (totalSales / totalClicks) * 100 : 0
  const avgCommission = totalSales > 0 ? totalCommission / totalSales : 0
  const totalDiscount = totalOriginalAmount - totalRevenue

  return NextResponse.json({
    byPlan,
    totalClicks,
    totalSales,
    totalCommission,
    totalRevenue,
    totalOriginalAmount,
    totalDiscount,
    conversionRate,
    avgCommission,
  })
}
