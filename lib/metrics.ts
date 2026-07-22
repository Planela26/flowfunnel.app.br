export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator === 0) return null
  const v = numerator / denominator
  return Number.isFinite(v) ? v : null
}

export function calculateCTR(clicks: number, impressions: number): number | null {
  const r = safeDiv(clicks, impressions)
  return r === null ? null : r * 100
}

export function calculateCPC(cost: number, clicks: number): number | null {
  return safeDiv(cost, clicks)
}

export function calculateCPM(cost: number, impressions: number): number | null {
  const r = safeDiv(cost, impressions)
  return r === null ? null : r * 1000
}

export function calculateConversion(leads: number, clicks: number): number | null {
  const r = safeDiv(leads, clicks)
  return r === null ? null : r * 100
}

export function calculateROI(revenue: number, cost: number): number {
  if (!Number.isFinite(revenue) || !Number.isFinite(cost)) return 0
  if (!cost || cost === 0) return 0
  const roi = revenue / cost
  if (!Number.isFinite(roi)) return 0
  return (roi - 1) * 100
}

export function hasROI(revenue: number, cost: number): boolean {
  return Number.isFinite(revenue) && Number.isFinite(cost) && cost > 0
}

export function calculateROAS(revenue: number, cost: number): number {
  if (!Number.isFinite(revenue) || !Number.isFinite(cost) || cost <= 0) return 0
  const v = revenue / cost
  return Number.isFinite(v) ? v : 0
}

export type ConsistencyIssue = { metric: string; total: number; sumOfSources: number; diff: number }

export function auditConsistency(
  total: Partial<AggregatedTotals>,
  sources: Partial<AggregatedTotals>[],
  tolerance = 0.01,
): ConsistencyIssue[] {
  const sum = sumTotals(sources)
  const issues: ConsistencyIssue[] = []
  const keys: (keyof AggregatedTotals)[] = ['clicks', 'impressions', 'spend', 'leads', 'revenue']
  for (const k of keys) {
    const t = (total[k] ?? 0) as number
    const s = sum[k]
    if (Math.abs(t - s) > tolerance) {
      issues.push({ metric: k, total: t, sumOfSources: s, diff: t - s })
    }
  }
  return issues
}

export type AggregatedTotals = {
  clicks: number
  impressions: number
  spend: number
  leads: number
  revenue: number
}

export function sumTotals(items: Partial<AggregatedTotals>[]): AggregatedTotals {
  return items.reduce<AggregatedTotals>((acc, it) => ({
    clicks:      acc.clicks      + (it.clicks      ?? 0),
    impressions: acc.impressions + (it.impressions ?? 0),
    spend:       acc.spend       + (it.spend       ?? 0),
    leads:       acc.leads       + (it.leads       ?? 0),
    revenue:     acc.revenue     + (it.revenue     ?? 0),
  }), { clicks: 0, impressions: 0, spend: 0, leads: 0, revenue: 0 })
}

export function distributeByClicks<T extends { cliques: number }>(
  sources: T[],
  total: number,
): number[] {
  const totalClicks = sources.reduce((a, s) => a + s.cliques, 0)
  if (total <= 0 || totalClicks <= 0) return sources.map(() => 0)
  const result: number[] = []
  let allocated = 0
  sources.forEach((s, idx) => {
    const isLast = idx === sources.length - 1
    if (isLast) {
      result.push(Math.max(0, total - allocated))
    } else {
      const v = (total * s.cliques) / totalClicks
      const rounded = Math.round(v * 100) / 100
      result.push(Math.max(0, rounded))
      allocated += rounded
    }
  })
  return result
}

export function formatPct(v: number | null, digits = 2): string {
  if (v === null) return '—'
  return v.toFixed(digits).replace('.', ',') + '%'
}

export function formatBRL(v: number | null, digits = 2): string {
  if (v === null) return '—'
  return 'R$ ' + v.toFixed(digits).replace('.', ',')
}
