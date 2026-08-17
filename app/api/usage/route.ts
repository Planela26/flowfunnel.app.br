import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendUsageLimitWarningEmail } from '@/lib/email'
import { getEffectivePlan } from '@/lib/trial'
import { currentCycleStart, currentCycleEnd } from '@/lib/plan-expiry'

const PLAN_LIMITS: Record<string, number> = {
  FREE:  0,
  START: 1000,
  PRO:   3000,
  SCALE: -1, // unlimited
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, email: true, name: true, trialEndsAt: true, trialPlan: true, trialStatus: true, planExpiresAt: true },
    })

    const plan = getEffectivePlan(user ?? { plan: 'FREE' })
    const limit = PLAN_LIMITS[plan] ?? 0

    // A cota acompanha o CICLO PAGO, não o mês do calendário.
    //
    // Zerando no dia 1º, quem assinava dia 28 ganhava cota nova três dias
    // depois — dois períodos de uso por um pagamento. Ancorando no vencimento,
    // o período contado é exatamente o período cobrado. Quem não tem período
    // pago (gratuito ou em teste) continua no mês corrente. Ver lib/plan-expiry.ts.
    const now = new Date()
    const inicioDoCiclo = currentCycleStart(user, now)

    const used = await prisma.webhookLog.count({
      where: {
        userId: session.user.id,
        platform: 'WHATSAPP',
        event: 'message',
        createdAt: { gte: inicioDoCiclo },
      },
    })

    const unlimited = limit === -1
    const percent = unlimited ? 0 : limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100
    const remaining = unlimited ? -1 : Math.max(0, limit - used)
    const isNearLimit = !unlimited && percent >= 80
    const isOverLimit = !unlimited && used >= limit && limit > 0

    // Send warning email at 80% threshold (fire-and-forget, no await to keep response fast)
    if (isNearLimit && user?.email && limit > 0) {
      const thresholdKey = `usage_warned_${session.user.id}_${now.getMonth()}_${now.getFullYear()}`
      // Use a simple in-memory dedup per month stored in a Notification record
      prisma.notification.findFirst({
        where: {
          userId: session.user.id,
          type: 'USAGE_WARNING',
          // Mesma janela da cota: um aviso por ciclo pago. Usando o mês, quem
          // virasse o mês no meio do período receberia o aviso duas vezes.
          createdAt: { gte: inicioDoCiclo },
        },
      }).then(existing => {
        if (!existing) {
          sendUsageLimitWarningEmail(user.email, user.name || '', used, limit)
          prisma.notification.create({
            data: {
              userId: session.user.id,
              type: 'USAGE_WARNING',
              title: 'Aviso de limite de uso',
              message: `${percent}% do limite de conversas utilizado`,
            },
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    return NextResponse.json(
      {
        plan,
        used,
        limit,
        unlimited,
        percent,
        remaining,
        isNearLimit,
        isOverLimit,
        resetDate: currentCycleEnd(user, now).toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('Erro ao buscar uso:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
