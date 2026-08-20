import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanFeatures, getHistoryLimitDays, getPlanLimit, isUnlimited, normalizePlan, PLAN_LABELS } from '@/lib/plans'
import { getEffectivePlan, isTrialActive, isTrialExpired, isPendingPayment, isPendingEmail, trialDaysLeft } from '@/lib/trial'
import { resolveCommercialAccess } from '@/lib/commercial-access'
import { getSaraCapabilities } from '@/lib/sara-capabilities'
import { maybeSweepInBackground } from '@/lib/pix-reminder'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Aproveita esta requisição para varrer os PIX não pagos, no máximo uma vez a
  // cada 10 minutos. Esta rota foi escolhida por ser das mais chamadas — o
  // usePlan roda no carregamento das páginas autenticadas.
  //
  // Não é aguardado de propósito: o resultado não interessa a quem só estava
  // abrindo uma tela, e a resposta do plano não pode esperar por consultas ao
  // Mercado Pago nem por envio de e-mail.
  maybeSweepInBackground()
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      role: true,
      trialEndsAt: true,
      trialPlan: true,
      trialStatus: true,
      trialPromptSeenAt: true,
      subscriptionStatus: true,
      paymentMethodAddedAt: true,
      gracePeriodEndsAt: true,
      planExpiresAt: true,
      // Suspensão administrativa. Sem este campo a tela diria "acesso liberado"
      // para uma conta desativada, e o gate diria o contrário — a divergência
      // entre tela e backend é justamente o que produziu o erro errado antes.
      deactivatedAt: true,
    },
  })

  const effectivePlan = getEffectivePlan(u ?? { plan: 'FREE' })
  const onTrial = isTrialActive(u ?? { plan: 'FREE' })
  const trialExpired = isTrialExpired(u ?? { plan: 'FREE' })
  const daysLeft = trialDaysLeft(u?.trialEndsAt)
  const cardAdded = Boolean(u?.paymentMethodAddedAt)
  // MESMA função que o gate das integrações usa (lib/integration-gate.ts), com
  // o objeto do banco inteiro. Passar campo a campo era o risco: bastava
  // esquecer um — como já aconteceu com `planExpiresAt` e `trialStatus` — para
  // a guarda existir no código e nunca receber o dado.
  const acesso = resolveCommercialAccess(u)
  const paidAccess = acesso.allowed
  // Modo explorar — sem cartão E sem assinatura. Pode usar o funil, mas sem criar integrações reais.
  const exploringOnly = !paidAccess
  // Motivo do bloqueio, para a interface escolher entre "assine" e "renove" em
  // vez de mostrar um convite genérico a quem já é cliente.
  const accessDenialCode = acesso.allowed ? null : acesso.code
  const accessMessage = acesso.allowed ? null : acesso.message
  const accessActionUrl = acesso.allowed ? null : acesso.actionUrl

  return NextResponse.json(
    {
      plan: effectivePlan,
      label: PLAN_LABELS[effectivePlan],
      role: u?.role || 'PRODUTOR',
      limit: getPlanLimit(effectivePlan),
      unlimited: isUnlimited(effectivePlan),
      historyDays: getHistoryLimitDays(effectivePlan),
      features: getPlanFeatures(effectivePlan),
      // Capacidades da Sara para a UI escolher a marca (SARA.AI vs
      // SARA.AI+ 2.0) e mostrar o que está bloqueado. É espelho da decisão do
      // backend, nunca a proteção: as rotas revalidam tudo por conta própria.
      sara: getSaraCapabilities(effectivePlan),
      trialActive: onTrial,
      trialExpired,
      trialDaysLeft: daysLeft,
      trialPlan: u?.trialPlan ?? null,
      trialEndsAt: u?.trialEndsAt?.toISOString() ?? null,
      trialStatus: u?.trialStatus ?? 'none',
      trialPendingPayment: isPendingPayment(u ?? { plan: 'FREE' }),
      trialPendingEmail: isPendingEmail(u ?? { plan: 'FREE' }),
      trialPromptSeenAt: u?.trialPromptSeenAt?.toISOString() ?? null,
      cardAdded,
      paidAccess,
      exploringOnly,
      accessDenialCode,
      accessMessage,
      accessActionUrl,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  )
}
