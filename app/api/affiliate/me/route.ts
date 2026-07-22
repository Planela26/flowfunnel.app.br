import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
    include: {
      clicks: { orderBy: { createdAt: 'desc' }, take: 5 },
      sales: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!affiliate) return NextResponse.json({ affiliate: null })

  const stats = {
    clicks: await prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
    sales: await prisma.affiliateSale.count({ where: { affiliateId: affiliate.id } }),
    totalCommission: (await prisma.affiliateSale.aggregate({
      where: { affiliateId: affiliate.id },
      _sum: { commissionAmount: true },
    }))._sum.commissionAmount ?? 0,
    totalRevenue: (await prisma.affiliateSale.aggregate({
      where: { affiliateId: affiliate.id },
      _sum: { discountedAmount: true },
    }))._sum.discountedAmount ?? 0,
  }

  return NextResponse.json({ affiliate, stats, recentSales: affiliate.sales })
}

// Default affiliate terms — mirrors the admin panel default form
// (app/admin/affiliates emptyForm): 10% de desconto / 20% de comissão.
const DEFAULT_DISCOUNT_PERCENT = 10
const DEFAULT_COMMISSION_PERCENT = 20

function slugifyCodeBase(input: string): string {
  const base = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10)
  return base || 'AFILIADO'
}

async function generateUniqueCode(base: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const code = `${base}${suffix}`
    const clash = await prisma.affiliate.findUnique({ where: { code } })
    if (!clash) return code
  }
  // Fallback extremamente improvável: usa timestamp para garantir unicidade.
  return `${base}${Date.now().toString(36).toUpperCase()}`
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.affiliate.findUnique({ where: { userId: session.user.id } })
  if (existing) return NextResponse.json({ error: 'Você já é afiliado' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  })

  const name = user?.name || session.user.name || user?.email || session.user.email || 'Afiliado'
  const email = user?.email || session.user.email || null
  const codeBase = slugifyCodeBase(user?.name || session.user.name || (email ? email.split('@')[0] : ''))

  // Race-safe: a checagem prévia + create não é atômica. Em POSTs concorrentes
  // a constraint única pode disparar P2002 — em `userId` (já virou afiliado) ou
  // em `code` (colisão de código gerado). Retentamos o código; tratamos userId.
  let affiliate
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateUniqueCode(codeBase)
    try {
      affiliate = await prisma.affiliate.create({
        data: {
          name,
          email,
          code,
          discountPercent: DEFAULT_DISCOUNT_PERCENT,
          commissionPercent: DEFAULT_COMMISSION_PERCENT,
          isActive: true,
          userId: session.user.id,
        },
      })
      break
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const target = (e?.meta?.target as string[] | string | undefined) ?? ''
        const targetStr = Array.isArray(target) ? target.join(',') : String(target)
        if (targetStr.includes('userId')) {
          return NextResponse.json({ error: 'Você já é afiliado' }, { status: 400 })
        }
        // Colisão de código: tenta novamente com um novo código.
        continue
      }
      throw e
    }
  }

  if (!affiliate) {
    return NextResponse.json({ error: 'Não foi possível gerar um código de afiliado único. Tente novamente.' }, { status: 500 })
  }

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: 'success',
      title: 'Você agora é afiliado!',
      message: `Seu código de afiliado é ${affiliate.code}. Compartilhe e ganhe ${DEFAULT_COMMISSION_PERCENT}% de comissão em cada venda.`,
    },
  })

  return NextResponse.json({ ok: true, affiliate })
}
