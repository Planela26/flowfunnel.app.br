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
