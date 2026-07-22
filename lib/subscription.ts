/**
 * Subscription status utilities.
 *
 * subscriptionStatus values:
 *   null         → never subscribed (FREE, normal access with plan limits)
 *   'active'     → paid plan active
 *   'past_due'   → payment failed, grace period applies
 *   'cancelled'  → subscription cancelled
 *   'expired'    → plan expired (MercadoPago / manual)
 */

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | null

export const GRACE_PERIOD_DAYS = 3

/**
 * Returns true when the user should be BLOCKED from accessing the system.
 * Users who never subscribed (null) are NOT blocked — they get FREE-tier limits instead.
 */
export function isSubscriptionBlocked(
  subscriptionStatus: string | null | undefined,
  gracePeriodEndsAt: Date | string | null | undefined,
): boolean {
  if (!subscriptionStatus) return false
  if (subscriptionStatus === 'active') return false

  if (subscriptionStatus === 'past_due') {
    if (!gracePeriodEndsAt) return true
    return new Date() > new Date(gracePeriodEndsAt)
  }

  return true
}

/**
 * Returns true when the user is inside the grace period (past_due but still allowed).
 * The UI should show a payment warning banner.
 */
export function isInGracePeriod(
  subscriptionStatus: string | null | undefined,
  gracePeriodEndsAt: Date | string | null | undefined,
): boolean {
  if (subscriptionStatus !== 'past_due') return false
  if (!gracePeriodEndsAt) return false
  return new Date() <= new Date(gracePeriodEndsAt)
}

/**
 * Days remaining in the grace period (0 if expired or not in grace period).
 */
export function graceDaysLeft(gracePeriodEndsAt: Date | string | null | undefined): number {
  if (!gracePeriodEndsAt) return 0
  const diff = new Date(gracePeriodEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Computes the grace period end date (3 days from now).
 */
export function computeGracePeriodEnd(): Date {
  const d = new Date()
  d.setDate(d.getDate() + GRACE_PERIOD_DAYS)
  return d
}
