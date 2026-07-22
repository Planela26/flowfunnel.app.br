/**
 * Trial expiration helper for auth JWT — lightweight version without
 * importing the full lib/trial.ts tree to avoid module bundling issues.
 */

export function isTrialExpiredForToken(user: {
  trialStatus?: string | null
  trialEndsAt?: Date | null
  trialPlan?: string | null
  plan?: string | null
} | null): boolean {
  if (!user) return false

  const status = user.trialStatus
  if (status === 'expired') return true
  if (status === 'active') {
    if (!user.trialEndsAt) return false
    return new Date() >= new Date(user.trialEndsAt)
  }
  // Legacy/none status: check if trial was started but not converted
  if (!status || status === 'none') {
    if (!user.trialPlan || !user.trialEndsAt) return false
    // If user already upgraded from FREE, trial is effectively converted
    if (user.plan && user.plan !== 'FREE') return false
    return new Date() >= new Date(user.trialEndsAt)
  }
  return false
}
