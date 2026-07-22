'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { Feature, Plan } from '@/lib/plans'
import { useCachedJSON } from '@/lib/clientCache'

export type PlanInfo = {
  plan: Plan
  label: string
  role: string
  limit: number
  unlimited: boolean
  historyDays: number
  features: Record<Feature, boolean>
  trialActive: boolean
  trialExpired: boolean
  trialDaysLeft: number
  trialPlan: string | null
  trialEndsAt: string | null
  trialStatus: string
  trialPendingPayment: boolean
  trialPendingEmail: boolean
}

const DEFAULT: PlanInfo = {
  plan: 'FREE',
  label: 'Grátis',
  role: 'PRODUTOR',
  limit: 0,
  unlimited: false,
  historyDays: 7,
  features: {
    lead_scoring: false,
    lead_classification: false,
    wasted_traffic: false,
    smart_suggestions: false,
    full_history: false,
    detailed_diagnostic: false,
    detailed_insights: false,
    campaign_actions: false,
    period_comparison: false,
    automatic_alerts: false,
    trend_analysis: false,
  },
  trialActive: false,
  trialExpired: false,
  trialDaysLeft: 0,
  trialPlan: null,
  trialEndsAt: null,
  trialStatus: 'none',
  trialPendingPayment: false,
  trialPendingEmail: false,
}

interface PlanContextType {
  info: PlanInfo
  loading: boolean
}

const PlanContext = createContext<PlanContextType>({ info: DEFAULT, loading: true })

export function PlanProvider({ children }: { children: ReactNode }) {
  const { data } = useCachedJSON<PlanInfo>('/api/plan', { refreshIntervalMs: 60000 })
  const info = data ?? DEFAULT
  const loading = data === undefined

  return (
    <PlanContext.Provider value={{ info, loading }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlanContext() {
  return useContext(PlanContext)
}
