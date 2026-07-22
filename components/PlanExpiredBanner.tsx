'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'

/**
 * Aviso discreto (modo somente leitura) exibido no topo quando o plano está
 * vencido — teste grátis expirado OU assinatura paga inativa.
 *
 * NÃO bloqueia a tela, não cobre a interface e não impede cliques: o usuário
 * continua vendo e navegando por todos os dados já existentes. Apenas comunica
 * que NÃO entrarão novos dados/leads/atualizações até a assinatura ser renovada.
 */
export default function PlanExpiredBanner() {
  const router = useRouter()
  const [expired, setExpired] = useState(false)
  const [trialPlan, setTrialPlan] = useState<string | null>(null)
  const [isTrial, setIsTrial] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.expired) {
          setExpired(true)
          setIsTrial(Boolean(data.trialExpired))
          setTrialPlan(data.trialPlan ?? null)
        }
      })
      .catch(() => {})
  }, [])

  if (!expired || dismissed) return null

  // Trial expirado vai pro checkout do plano testado; assinatura vencida vai pro billing.
  const renewHref = isTrial
    ? `/checkout?plan=${(trialPlan ?? 'PRO').toUpperCase()}`
    : '/billing'

  return (
    <div className="w-full px-4 py-2.5 flex items-center gap-3 text-sm bg-amber-900/70 border-b border-amber-600/40">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
      <span className="flex-1 font-medium text-amber-100">
        Seu plano está vencido. Você não receberá novos dados, leads ou
        atualizações até renovar sua assinatura.
      </span>
      <button
        onClick={() => router.push(renewHref)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition bg-amber-500 hover:bg-amber-400 text-gray-900"
      >
        <RefreshCw className="w-3 h-3" />
        {isTrial ? 'Fazer Upgrade' : 'Renovar Assinatura'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-300/70 hover:text-white transition flex-shrink-0"
        title="Fechar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
