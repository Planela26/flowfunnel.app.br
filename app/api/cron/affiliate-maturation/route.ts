import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { matureCommission } from '@/lib/affiliate-ledger'

// Job de maturação — promove AffiliateCommission PENDING -> AVAILABLE quando
// maturesAt <= now() (Decisão D: 15 dias, §4.3/§24.6). Idempotente por
// comissão (matureCommission usa UPDATE condicional no próprio status).
//
// Disparo: mesmo padrão de cron/alerts — cURL com
// `Authorization: Bearer <CRON_SECRET>`, GET ou POST.
export async function POST(request: Request) {
  return runMaturation(request)
}

export async function GET(request: Request) {
  return runMaturation(request)
}

async function runMaturation(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET não configurado — endpoint /api/cron/affiliate-maturation bloqueado')
      return NextResponse.json({ error: 'CRON_SECRET não configurado no servidor' }, { status: 500 })
    }
    const headerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const dryRun = url.searchParams.get('dryRun') === '1'

    const due = await prisma.affiliateCommission.findMany({
      where: { status: 'PENDING', maturesAt: { lte: new Date() } },
      select: { id: true },
    })

    let matured = 0
    if (!dryRun) {
      for (const commission of due) {
        const result = await matureCommission(commission.id)
        if (result.matured) matured++
      }
    }

    return NextResponse.json({ success: true, dryRun, candidates: due.length, matured })
  } catch (error: any) {
    console.error('Erro no job de maturação de comissões:', error)
    return NextResponse.json({ error: 'Erro no job de maturação' }, { status: 500 })
  }
}
