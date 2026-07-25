'use client'

import { useRouter } from 'next/navigation'
import { Clock, Zap, X, Compass } from 'lucide-react'
import { useState } from 'react'
import { usePlan } from './usePlan'

const PLAN_LABELS: Record<string, string> = {
  START: 'START', PRO: 'PRO', SCALE: 'SCALE',
}

export default function TrialBanner() {
  const { info, loading } = usePlan()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (loading || dismissed) return null

  const planLabel = PLAN_LABELS[info.trialPlan ?? ''] ?? info.trialPlan ?? info.label

  // ── Caso 1: plano já pago (mensalidade Stripe ou PIX MercadoPago aprovado) ──
  // Mostra apenas o nome do plano, sem falar em "teste grátis".
  if (info.paidAccess && info.plan !== 'FREE') {
    return (
      <div className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium bg-emerald-600 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 shrink-0" />
          <span className="truncate">
            Plano {planLabel} ativo — recursos liberados imediatamente.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push('/billing')}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white text-emerald-700 hover:bg-emerald-50 transition"
          >
            <Zap className="w-3 h-3" />
            Gerenciar
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

  // ── Caso 2: em trial com CARTÃO adicionado → "teste grátis" é legítimo ──
  // O trial real só vale a pena financeira se houver cartão cadastrado na Stripe.
  if (info.trialActive && info.cardAdded) {
    const days = info.trialDaysLeft
    const urgent = days <= 2
    return (
      <div
        className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium
          ${urgent ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {days === 0
              ? `Seu teste grátis do Plano ${planLabel} expira hoje!`
              : days === 1
              ? `Último dia do seu teste grátis do Plano ${planLabel}`
              : `Teste grátis: ${days} dias restantes no Plano ${planLabel}`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push('/billing')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition
              ${urgent ? 'bg-white text-amber-600 hover:bg-amber-50' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
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

  // ── Caso 3: explorando sem cartão ──
  // NÃO prometer "teste grátis" — o usuário só está conhecendo a plataforma.
  // Tudo o que ele criar/importar fica na preview; só conecta integração real
  // depois de cartão ou PIX.
  if (info.trialActive) {
    const days = info.trialDaysLeft
    return (
      <div className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium bg-slate-700 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {days === 0
              ? `Você está explorando a Plataforma. Adicione um cartão ou pague via PIX para liberar integrações.`
              : `Você está conhecendo a plataforma — ${days} ${days === 1 ? 'dia' : 'dias'} pra decidir. Adicione cartão (7 dias grátis) ou pague via PIX.`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push('/billing')}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 transition"
          >
            <Zap className="w-3 h-3" />
            Liberar agora
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

  return null
}
