/**
 * Account access status — read-only mode for expired/blocked accounts.
 *
 * Em vez de bloquear toda a plataforma quando o plano vence (teste grátis
 * expirado ou assinatura paga cancelada/expirada/past_due fora da carência),
 * o usuário continua vendo e navegando por TODOS os dados já existentes. O que
 * muda é que a ENTRADA de novos dados (webhooks/leads/conversões) é interrompida
 * até a assinatura ser renovada — modo somente leitura.
 */

import { isSubscriptionBlocked } from './subscription'
import { isTrialExpiredForToken } from './auth-trial'
import { prismaAdmin } from './prisma'

export type AccountStatusFields = {
  subscriptionStatus?: string | null
  gracePeriodEndsAt?: Date | string | null
  trialStatus?: string | null
  trialEndsAt?: Date | null
  trialPlan?: string | null
  plan?: string | null
}

/**
 * Retorna true quando a conta está vencida: teste grátis expirado OU assinatura
 * paga inativa (cancelada/expirada/past_due além da carência). Contas FREE que
 * nunca assinaram nem ativaram teste NÃO são consideradas vencidas.
 */
export function isAccountExpired(user: AccountStatusFields | null): boolean {
  if (!user) return false
  if (isSubscriptionBlocked(user.subscriptionStatus, user.gracePeriodEndsAt)) return true
  if (isTrialExpiredForToken(user)) return true
  return false
}

/**
 * Versão que consulta o banco — usada nas rotas de ingestão (webhooks/tracker)
 * para decidir se devemos PARAR de processar novos dados do tenant.
 *
 * Fail-open: em erro transitório de banco, NÃO derruba a ingestão (retorna false)
 * para evitar perder dados de clientes pagantes por uma falha pontual.
 */
export async function isIngestionBlockedForUser(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false
  try {
    const user = await prismaAdmin.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        gracePeriodEndsAt: true,
        trialStatus: true,
        trialEndsAt: true,
        trialPlan: true,
        plan: true,
      },
    })
    return isAccountExpired(user)
  } catch (e) {
    console.error('[account-status] erro ao checar ingestão; fail-open:', e)
    return false
  }
}
