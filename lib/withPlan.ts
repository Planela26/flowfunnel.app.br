import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import {
  canAccessFeature,
  normalizePlan,
  PLAN_LABELS,
  FEATURE_MIN_PLAN,
  type Feature,
  type Plan,
} from './plans'
import { getEffectivePlan } from './trial'
import {
  getSaraCapabilities,
  minPlanForCapability,
  upgradeMessageFor,
  type SaraCapabilities,
  type SaraCapability,
} from './sara-capabilities'

export type AuthedUser = {
  id: string
  email: string
  plan: Plan
  role: string
}

/**
 * Garante que existe sessão e (opcionalmente) que o plano libera a feature.
 * Usa o plano efetivo (considera trial ativo).
 * Retorna { user } em caso de sucesso ou { response } com a resposta de erro pronta.
 */
export async function requireFeature(feature?: Feature): Promise<
  | { user: AuthedUser; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    // `trialStatus` é obrigatório: `isTrialActive` só reconhece o trial pelo
    // caminho `status === 'active'`. Sem o campo, o trial de quem JÁ tem plano
    // pago era ignorado e TODO gate de feature respondia pelo plano antigo —
    // enquanto /api/plan, que seleciona o campo, mostrava o plano do trial.
    select: {
      id: true, email: true, plan: true, role: true,
      trialEndsAt: true, trialPlan: true, trialStatus: true,
    },
  })

  if (!dbUser) {
    return { response: NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 }) }
  }

  const plan = getEffectivePlan(dbUser)
  const user: AuthedUser = { id: dbUser.id, email: dbUser.email, plan, role: dbUser.role }

  if (feature && !canAccessFeature(plan, feature)) {
    const requiredPlan = FEATURE_MIN_PLAN[feature]
    const requiredLabel = PLAN_LABELS[requiredPlan]
    return {
      response: NextResponse.json(
        {
          error: 'plan_required',
          feature,
          currentPlan: plan,
          requiredPlan,
          message: `Esta funcionalidade está disponível a partir do plano ${requiredLabel}.`,
          upgradeUrl: '/billing',
        },
        { status: 402 }
      ),
    }
  }

  return { user }
}

/**
 * Mesmo contrato de `requireFeature`, para capacidades da Sara.AI.
 *
 * Existe para que nenhuma rota escreva `if (plan === 'SCALE')`: a decisão fica
 * em `lib/sara-capabilities`, e a resposta de bloqueio sai daqui com a mensagem
 * comercial pronta — o usuário não errou, ele só não contratou aquilo ainda.
 */
export async function requireSaraCapability(capability: SaraCapability): Promise<
  | { user: AuthedUser; capabilities: SaraCapabilities; response?: undefined }
  | { user?: undefined; capabilities?: undefined; response: NextResponse }
> {
  const guard = await requireFeature()
  if (guard.response) return { response: guard.response }

  const capabilities = getSaraCapabilities(guard.user.plan)
  if (!capabilities[capability]) {
    const requiredPlan = minPlanForCapability(capability)
    return {
      response: NextResponse.json(
        {
          error: 'plan_required',
          capability,
          currentPlan: guard.user.plan,
          requiredPlan,
          message: upgradeMessageFor(capability),
          upgradeUrl: '/billing',
        },
        { status: 402 }
      ),
    }
  }

  return { user: guard.user, capabilities }
}
