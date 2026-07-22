/**
 * Definição central de planos, features e limites.
 * Reutilizado tanto no backend quanto no frontend.
 */

export type Plan = 'FREE' | 'START' | 'PRO' | 'SCALE'

export const PLAN_LIMITS: Record<Plan, number> = {
  FREE: 0,
  START: 1000,
  PRO: 3000,
  SCALE: -1, // ilimitado
}

export const PLAN_HISTORY_DAYS: Record<Plan, number> = {
  FREE: 7,
  START: 7,
  PRO: 365,
  SCALE: 365,
}

/** Limite de funis ativos por plano. -1 = ilimitado. */
export const PLAN_FUNNEL_LIMITS: Record<Plan, number> = {
  FREE: 1,
  START: 1,
  PRO: 3,
  SCALE: -1,
}

/** Limite de números de WhatsApp conectados por plano. -1 = ilimitado. */
export const PLAN_WHATSAPP_LIMITS: Record<Plan, number> = {
  FREE: 1,
  START: 1,
  PRO: 3,
  SCALE: -1,
}

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: 'Grátis',
  START: 'START',
  PRO: 'PRO',
  SCALE: 'SCALE',
}

/** Preço mensal em BRL por plano. Fonte única para cálculos de MRR/receita. */
export const PLAN_PRICES_BRL: Record<Plan, number> = {
  FREE: 0,
  START: 97,
  PRO: 147,
  SCALE: 297,
}

export function getPlanPriceBRL(plan: string | null | undefined): number {
  return PLAN_PRICES_BRL[normalizePlan(plan)]
}

export const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  START: 1,
  PRO: 2,
  SCALE: 3,
}

/** Features liberadas por plano. */
export type Feature =
  | 'lead_scoring'
  | 'lead_classification'
  | 'wasted_traffic'
  | 'smart_suggestions'
  | 'full_history'
  | 'detailed_diagnostic'
  | 'detailed_insights'
  | 'campaign_actions'
  | 'period_comparison'
  | 'automatic_alerts'
  | 'trend_analysis'

export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  lead_scoring: 'START',
  lead_classification: 'START',
  wasted_traffic: 'START',
  smart_suggestions: 'START',
  full_history: 'PRO',
  detailed_diagnostic: 'PRO',
  detailed_insights: 'PRO',
  campaign_actions: 'PRO',
  period_comparison: 'PRO',
  automatic_alerts: 'SCALE',
  trend_analysis: 'SCALE',
}

export function normalizePlan(plan: string | null | undefined): Plan {
  const p = (plan || 'FREE').toUpperCase()
  if (p === 'FREE' || p === 'START' || p === 'PRO' || p === 'SCALE') return p
  return 'FREE'
}

export function canAccessFeature(plan: string | null | undefined, feature: Feature): boolean {
  const p = normalizePlan(plan)
  const min = FEATURE_MIN_PLAN[feature]
  return PLAN_RANK[p] >= PLAN_RANK[min]
}

export function getHistoryLimitDays(plan: string | null | undefined): number {
  return PLAN_HISTORY_DAYS[normalizePlan(plan)]
}

export function getPlanLimit(plan: string | null | undefined): number {
  return PLAN_LIMITS[normalizePlan(plan)]
}

export function isUnlimited(plan: string | null | undefined): boolean {
  return getPlanLimit(plan) === -1
}

/** Limite de funis ativos para o plano. -1 = ilimitado. */
export function getMaxFunnels(plan: string | null | undefined): number {
  return PLAN_FUNNEL_LIMITS[normalizePlan(plan)]
}

/** Limite de números WhatsApp para o plano. -1 = ilimitado. */
export function getMaxWhatsappNumbers(plan: string | null | undefined): number {
  return PLAN_WHATSAPP_LIMITS[normalizePlan(plan)]
}

/** Lista de features disponíveis para cada plano (útil para o cliente). */
export function getPlanFeatures(plan: string | null | undefined): Record<Feature, boolean> {
  const result = {} as Record<Feature, boolean>
  for (const f of Object.keys(FEATURE_MIN_PLAN) as Feature[]) {
    result[f] = canAccessFeature(plan, f)
  }
  return result
}
