import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

// Job de reconciliação — recalcula SUM(ledger) por afiliado/conta e compara
// com AffiliateWallet (§2.3/§3.1). SÓ ALERTA, nunca corrige sozinho: uma
// correção automática num sistema financeiro pode mascarar um bug real em
// vez de expô-lo. Divergências viram AuditLog (result: 'failure') — ainda
// não há integração de Slack/e-mail neste projeto, então o alerta hoje é
// "fica registrado e visível", não "notifica alguém proativamente"; ligar um
// canal de notificação de verdade é trabalho futuro, fora do escopo desta
// fase.
//
// Disparo: mesmo padrão de cron/alerts.
export async function POST(request: Request) {
  return runReconciliation(request)
}

export async function GET(request: Request) {
  return runReconciliation(request)
}

type LedgerSum = { affiliateId: string; account: string; total: string }

async function runReconciliation(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET não configurado — endpoint /api/cron/affiliate-reconcile bloqueado')
      return NextResponse.json({ error: 'CRON_SECRET não configurado no servidor' }, { status: 500 })
    }
    const headerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sums = await prisma.$queryRaw<LedgerSum[]>`
      SELECT "affiliateId", account::text AS account, SUM(amount)::text AS total
      FROM "AffiliateLedgerEntry"
      GROUP BY "affiliateId", account
    `
    const byAffiliate = new Map<string, { pendingBalance: number; availableBalance: number; reservedBalance: number }>()
    for (const row of sums) {
      const entry = byAffiliate.get(row.affiliateId) ?? { pendingBalance: 0, availableBalance: 0, reservedBalance: 0 }
      const total = Number(row.total)
      if (row.account === 'PENDING') entry.pendingBalance = total
      else if (row.account === 'AVAILABLE') entry.availableBalance = total
      else if (row.account === 'RESERVED') entry.reservedBalance = total
      byAffiliate.set(row.affiliateId, entry)
    }

    const wallets = await prisma.affiliateWallet.findMany()
    const divergences: Array<{
      affiliateId: string
      field: string
      ledgerSum: number
      walletValue: number
    }> = []

    const EPSILON = 0.005 // tolerância de arredondamento de centavo

    for (const wallet of wallets) {
      const fromLedger = byAffiliate.get(wallet.affiliateId) ?? {
        pendingBalance: 0,
        availableBalance: 0,
        reservedBalance: 0,
      }
      const checks: Array<['pendingBalance' | 'availableBalance' | 'reservedBalance', number, number]> = [
        ['pendingBalance', fromLedger.pendingBalance, Number(wallet.pendingBalance)],
        ['availableBalance', fromLedger.availableBalance, Number(wallet.availableBalance)],
        ['reservedBalance', fromLedger.reservedBalance, Number(wallet.reservedBalance)],
      ]
      for (const [field, ledgerSum, walletValue] of checks) {
        if (Math.abs(ledgerSum - walletValue) > EPSILON) {
          divergences.push({ affiliateId: wallet.affiliateId, field, ledgerSum, walletValue })
        }
      }
    }

    for (const d of divergences) {
      console.error('[affiliate-reconcile] divergência de saldo detectada', d)
      await logAudit({
        action: 'affiliate.wallet.reconcile_divergence',
        result: 'failure',
        entityType: 'AffiliateWallet',
        entityId: d.affiliateId,
        metadata: d,
        request,
      })
    }

    return NextResponse.json({
      success: true,
      affiliatesChecked: wallets.length,
      divergences,
    })
  } catch (error: any) {
    console.error('Erro no job de reconciliação de carteira de afiliados:', error)
    return NextResponse.json({ error: 'Erro no job de reconciliação' }, { status: 500 })
  }
}
