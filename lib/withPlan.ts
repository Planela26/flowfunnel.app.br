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
    select: { id: true, email: true, plan: true, role: true, trialEndsAt: true, trialPlan: true },
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
