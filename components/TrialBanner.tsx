'use client'

import { useRouter } from 'next/navigation'
import { Clock, Zap, X } from 'lucide-react'
import { useState } from 'react'
import { usePlan } from './usePlan'

const PLAN_LABELS: Record<string, string> = {
  START: 'START',
  PRO: 'PRO',
  SCALE: 'SCALE',
}

export default function TrialBanner() {
  const { info, loading } = usePlan()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (loading || dismissed) return null
  if (!info.trialActive) return null

  const days = info.trialDaysLeft
  const planLabel = PLAN_LABELS[info.trialPlan ?? ''] ?? info.trialPlan
  const urgent = days <= 2

  return (
    <div
      className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium
        ${urgent
          ? 'bg-amber-500 text-white'
          : 'bg-blue-600 text-white'
        }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {days === 0
            ? `Seu teste grátis do Plano ${planLabel} expira hoje!`
            : days === 1
            ? `Último dia do seu teste grátis do Plano ${planLabel}`
            : `Teste grátis: ${days} dias restantes no Plano ${planLabel}`
          }
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => router.push('/billing')}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition
            ${urgent
              ? 'bg-white text-amber-600 hover:bg-amber-50'
              : 'bg-white text-blue-700 hover:bg-blue-50'
            }`}
        >
          <Zap className="w-3 h-3" />
          Assinar agora
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded hover:bg-white/20 transition"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
