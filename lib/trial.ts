import { normalizePlan, type Plan } from './plans'

export const TRIAL_DAYS = 7

export type TrialStatus =
  | 'none'
  | 'pending_email'
  | 'pending_payment'
  | 'active'
  | 'expired'
  | 'converted'

type TrialUser = {
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
 * Determina se o usuário tem direito a criar/alterar integrações e dados de
 * funil. Verdadeiro quando:
 *  - assinatura paga ativa (Stripe ou MercadoPago, qualquer tier START/PRO/SCALE), OU
 *  - cartão adicionado (trial em curso — mesmo que trialEndsAt ainda não estourou).
 *
 * Falso (modo "explorar apenas") para:
 *  - conta FREE recém-criada sem cartão, mesmo que trialEndsAt esteja populado.
 *
 * Por quê: o "teste grátis" só é realmente grátis (cancelável a qualquer
 * momento antes da cobrança) se houver cartão cadastrado na Stripe. Sem
 * cartão, o usuário só pode navegar — não pode adicionar Meta, WhatsApp,
 * Eduzz, Kiwify, Hotmart, Monetizze ou Perfect Pay.
 */
export function hasPaidAccess(user: {
  subscriptionStatus?: string | null
  paymentMethodAddedAt?: Date | string | null
  trialStatus?: string | null
  trialEndsAt?: Date | string | null
  trialPlan?: string | null
  plan?: string | null
  gracePeriodEndsAt?: Date | string | null
}): boolean {
  if (user.subscriptionStatus === 'active') return true

  // `paymentMethodAddedAt` é gravado uma vez e NUNCA é limpo. Sozinho, ele
  // concedia acesso vitalício: quem cancelasse a assinatura continuava criando
  // e reconectando integrações para sempre. Agora o cartão só vale enquanto o
  // direito de acesso existir de fato.
  if (!user.paymentMethodAddedAt) return false

  const status = user.subscriptionStatus
  if (status === 'canceled' || status === 'cancelled' || status === 'unpaid') return false

  // Fora do período de carência de inadimplência.
  if (user.gracePeriodEndsAt && new Date(user.gracePeriodEndsAt).getTime() <= Date.now()) {
    return false
  }

  // Cartão cadastrado durante um teste que já venceu, sem assinatura ativa.
  if (user.trialEndsAt && isTrialExpired(user as TrialUser)) return false

  return true
}
