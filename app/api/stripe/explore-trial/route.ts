import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { TRIAL_DAYS } from '@/lib/trial'

const PLAN_VALUES: Record<string, number> = { START: 97, PRO: 147, SCALE: 297 }

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

    const body = await request.json().catch(() => ({} as any))
    const planKey = String(body?.plan ?? 'START').toUpperCase()
    if (!['START', 'PRO', 'SCALE'].includes(planKey)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

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
      value: PLAN_VALUES[planKey] ?? 0,
    })
  } catch (error: any) {
    console.error('Erro ao iniciar trial exploratório:', error?.message)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
