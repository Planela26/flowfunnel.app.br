import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(request.url)
  const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 90)

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })

  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const [clicks, sales] = await Promise.all([
    prisma.affiliateClick.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.affiliateSale.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true, commissionAmount: true, discountedAmount: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Agregar por dia
  const daysMap = new Map<string, { date: string; clicks: number; sales: number; commission: number; revenue: number }>()

  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().split('T')[0]
    daysMap.set(key, { date: key, clicks: 0, sales: 0, commission: 0, revenue: 0 })
  }

  for (const c of clicks) {
    const key = new Date(c.createdAt).toISOString().split('T')[0]
    const entry = daysMap.get(key)
    if (entry) entry.clicks++
  }

  for (const s of sales) {
    const key = new Date(s.createdAt).toISOString().split('T')[0]
    const entry = daysMap.get(key)
    if (entry) {
      entry.sales++
      entry.commission += s.commissionAmount
      entry.revenue += s.discountedAmount
    }
  }

  const data = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ data, totalClicks: clicks.length, totalSales: sales.length })
}
