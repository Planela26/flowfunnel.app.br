import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { id } = await params

    const affiliate = await prisma.affiliate.findUnique({
      where: { id },
      include: {
        clicks: { orderBy: { createdAt: 'desc' }, take: 100 },
        sales: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
    }

    const totalCommission = affiliate.sales.reduce((sum, s) => sum + s.commissionAmount, 0)
    const totalRevenue = affiliate.sales.reduce((sum, s) => sum + s.discountedAmount, 0)

    return NextResponse.json({
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        code: affiliate.code,
        discountPercent: affiliate.discountPercent,
        commissionPercent: affiliate.commissionPercent,
        isActive: affiliate.isActive,
        createdAt: affiliate.createdAt,
      },
      stats: {
        clicks: affiliate.clicks.length,
        sales: affiliate.sales.length,
        totalCommission,
        totalRevenue,
      },
      recentSales: affiliate.sales.slice(0, 20).map(s => ({
        id: s.id,
        plan: s.plan,
        originalAmount: s.originalAmount,
        discountedAmount: s.discountedAmount,
        commissionAmount: s.commissionAmount,
        createdAt: s.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Erro ao buscar afiliado:', error)
    return NextResponse.json({ error: 'Erro ao buscar afiliado' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json()

    const data: any = {}
    if (body.name !== undefined) data.name = String(body.name)
    if (body.email !== undefined) data.email = body.email ? String(body.email) : null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.commissionPercent !== undefined) {
      const cp = Number(body.commissionPercent)
      if (!Number.isFinite(cp) || cp < 0 || cp > 90) {
        return NextResponse.json({ error: 'commissionPercent deve ser entre 0 e 90' }, { status: 400 })
      }
      data.commissionPercent = cp
    }
    if (body.discountPercent !== undefined) {
      const dp = Number(body.discountPercent)
      if (!Number.isFinite(dp) || dp < 0 || dp > 90) {
        return NextResponse.json({ error: 'discountPercent deve ser entre 0 e 90' }, { status: 400 })
      }
      data.discountPercent = dp
    }

    const affiliate = await prisma.affiliate.update({
      where: { id },
      data,
    })

    await logAudit({
      action: 'admin.affiliate_update',
      result: 'success',
      userId: auth.userId,
      entityType: 'Affiliate',
      entityId: id,
      request,
      metadata: { changes: Object.keys(data) },
    })

    return NextResponse.json({ affiliate })
  } catch (error: any) {
    console.error('Erro ao atualizar afiliado:', error)
    return NextResponse.json({ error: 'Erro ao atualizar afiliado' }, { status: 500 })
  }
}
