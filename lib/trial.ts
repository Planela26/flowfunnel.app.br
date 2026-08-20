import { normalizePlan, type Plan } from './plans'

/**
 * Duração do teste grátis, em dias. Fonte única — o texto das telas e dos
 * e-mails deriva daqui, então mudar o prazo não exige caçar strings.
 *
 * Não confundir com a garantia de 7 dias exibida no checkout: aquela é o
 * direito de arrependimento do CDC (art. 49) e tem prazo próprio, fixo em lei.
 */
export const TRIAL_DAYS = 14

export type TrialStatus =
  | 'none'
  | 'pending_email'
  | 'pending_payment'
  | 'active'
  | 'expired'
  | 'converted'

export type TrialUser = {
  plan: string
  trialEndsAt?: Date | null
  trialPlan?: string | null
  trialStatus?: string | null
}

export function isTrialActive(user: TrialUser): boolean {
  const status = user.trialStatus
  if (status === 'active') {
    if (!user.trialEndsAt) return false
    return new Date() < new Date(user.trialEndsAt)
  }
  if (!status || status === 'none') {
    if (!user.trialEndsAt || !user.trialPlan) return false
    if (normalizePlan(user.plan) !== 'FREE') return false
    return new Date() < new Date(user.trialEndsAt)
  }
  return false
}

export function trialDaysLeft(trialEndsAt: Date | null | undefined): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function isTrialExpired(user: TrialUser): boolean {
  const status = user.trialStatus
  if (status === 'expired') return true
  if (status === 'active') {
    if (!user.trialEndsAt) return false
    return new Date() >= new Date(user.trialEndsAt)
  }
  if (!status || status === 'none') {
    if (!user.trialPlan || !user.trialEndsAt) return false
    if (normalizePlan(user.plan) !== 'FREE') return false
    return new Date() >= new Date(user.trialEndsAt)
  }
  return false
}

export function isPendingPayment(user: TrialUser): boolean {
  return user.trialStatus === 'pending_payment'
}

export function isPendingEmail(user: TrialUser): boolean {
  return user.trialStatus === 'pending_email'
}

export function getEffectivePlan(user: TrialUser): Plan {
  if (isTrialActive(user) && user.trialPlan) {
    return normalizePlan(user.trialPlan)
  }
  return normalizePlan(user.plan)
}

/**
 * `hasPaidAccess` MUDOU DE CASA — está em lib/commercial-access.ts.
 *
 * A versão que vivia aqui decidia por booleano e, por isso, não conseguia
 * distinguir "nunca assinou" de "assinou e venceu": os dois viravam o mesmo
 * `card_required`, e quem tinha pagado PIX recebia o convite para "conhecer a
 * plataforma adicionando um cartão". A decisão agora devolve um código
 * semântico (`plan_expired`, `subscription_required`, `account_suspended`) e
 * enxerga `role`, para que a conta administrativa não seja barrada pelo fluxo
 * comercial do próprio produto.
 *
 * Este arquivo segue dono das regras de TESTE GRÁTIS, que o resolvedor consome.
 * Não reintroduza um predicado de acesso aqui: é o que fez tela e gate
 * divergirem.
 */
