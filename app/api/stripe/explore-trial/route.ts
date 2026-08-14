import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { TRIAL_DAYS } from '@/lib/trial'
import { getPlanPriceBRL } from '@/lib/plans'

// Tier do teste SEM cartão é decidido pelo servidor, nunca pelo cliente.
// Antes, `body.plan` era aceito e `{"plan":"SCALE"}` dava 7 dias do tier mais
// caro (funis/WhatsApps/conversas ilimitados, 365 dias de histórico) sem cartão
// e sem o antifraude de fingerprint — que só existe no trial COM cartão.
const EXPLORE_TRIAL_PLAN = 'START'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(`stripe:explore-trial:${ip}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // O corpo é lido mas o plano é ignorado de propósito: o tier vem do servidor.
    await request.json().catch(() => ({} as any))
    const planKey = EXPLORE_TRIAL_PLAN

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        name: true,
        emailVerified: true,
        trialStatus: true,
        paymentMethodAddedAt: true,
      },
    })

    if (!user?.emailVerified) {
      return NextResponse.json({ error: 'Confirme seu email antes de continuar.' }, { status: 403 })
    }

    if (user.trialStatus === 'active') {
      return NextResponse.json({ error: 'Você já tem um teste ativo.' }, { status: 400 })
    }

    if (user.trialStatus === 'converted') {
      return NextResponse.json({ error: 'Você já assinou um plano.' }, { status: 400 })
    }

    // Anti-abuso: quem já vinculou cartão a uma assinatura não pode usar a
    // exploração sem cartão — o caminho "Conhecer a plataforma primeiro"
    // existe só para quem AINDA não tem método de pagamento vinculado. Se um
    // cartão já foi adicionado em qualquer momento, exige-se passar pela
    // ativação normal (cartão → trial).
    if (user.paymentMethodAddedAt) {
      return NextResponse.json(
        { error: 'Já existe um cartão vinculado. Continue a ativação para iniciar o teste.' },
        { status: 409 },
      )
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        trialStatus: 'active',
        trialStartedAt: new Date(),
        trialEndsAt,
        trialPlan: planKey,
        trialPromptSeenAt: new Date(),
        // Sem stripeSubscriptionId nem paymentMethodAddedAt: marca registrada
        // de que este trial foi iniciado sem cartão. Páginas futuras (billing,
        // subscription-required) usam paymentMethodAddedAt===null para oferecer
        // o upsert de cartão em vez da criação de nova assinatura.
      },
    })

    // Sem cartão = sem email de "teste grátis". O email só é enviado quando
    // o usuário de fato adiciona um cartão via activate-trial.

    await logAudit({
      action: 'billing.trial_explore_started',
      result: 'success',
      userId: session.user.id,
      entityType: 'User',
      entityId: session.user.id,
      request,
      metadata: { plan: planKey, trialEndsAt: trialEndsAt.toISOString() },
    })

    return NextResponse.json({
      success: true,
      trialEndsAt: trialEndsAt.toISOString(),
      plan: planKey,
      value: getPlanPriceBRL(planKey),
    })
  } catch (error: any) {
    console.error('Erro ao iniciar trial exploratório:', error?.message ?? error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
