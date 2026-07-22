"use client"
import { useEffect, useState } from 'react'
import { CreditCard, Zap, Star, Rocket, Loader2, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface SubscriptionData {
  plan: string
  status: string
  hasStripe: boolean
  subscription: {
    id: string
    status: string
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    priceId: string | null
    amountBrl: string | null
  } | null
}

const PLAN_INFO: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  FREE: { label: 'Grátis', icon: Zap, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-200 dark:border-gray-600' },
  START: { label: 'START', icon: Star, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700' },
  PRO: { label: 'PRO', icon: Star, color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-700' },
  SCALE: { label: 'SCALE', icon: Rocket, color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-700' },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativa', color: 'text-green-600 dark:text-green-400' },
  trialing: { label: 'Em trial', color: 'text-blue-600 dark:text-blue-400' },
  past_due: { label: 'Pagamento pendente', color: 'text-yellow-600 dark:text-yellow-400' },
  canceled: { label: 'Cancelada', color: 'text-red-600 dark:text-red-400' },
  unpaid: { label: 'Não pago', color: 'text-red-600 dark:text-red-400' },
  free: { label: 'Plano Gratuito', color: 'text-gray-500 dark:text-gray-400' },
}

export default function SubscriptionCard() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    fetch('/api/stripe/subscription')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } catch {
      alert('Erro ao abrir portal de assinatura.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    )
  }

  const planKey = data?.plan ?? 'FREE'
  const planInfo = PLAN_INFO[planKey] ?? PLAN_INFO.FREE
  const PlanIcon = planInfo.icon
  const statusInfo = data?.status ? STATUS_LABEL[data.status] : STATUS_LABEL.free
  const sub = data?.subscription

  return (
    <div className={`rounded-2xl border ${planInfo.border} ${planInfo.bg} p-6 transition-colors`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Assinatura</h3>
            <p className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${planInfo.color} bg-white dark:bg-gray-800 shadow-sm`}>
          {planInfo.label}
        </span>
      </div>

      {sub && (
        <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
          {sub.amountBrl && (
            <div className="flex justify-between">
              <span>Valor</span>
              <span className="font-semibold text-gray-900 dark:text-white">R$ {sub.amountBrl}/mês</span>
            </div>
          )}
          {sub.currentPeriodEnd && (
            <div className="flex justify-between">
              <span>{sub.cancelAtPeriodEnd ? 'Acesso até' : 'Próxima renovação'}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{sub.currentPeriodEnd}</span>
            </div>
          )}
          {sub.cancelAtPeriodEnd && (
            <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 text-xs mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Cancelamento agendado ao fim do período
            </div>
          )}
          {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Assinatura ativa e renovando automaticamente
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        {data?.hasStripe ? (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-60"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Gerenciar assinatura
          </button>
        ) : (
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"
          >
            <ArrowRight className="w-4 h-4" />
            {planKey === 'FREE' ? 'Ver planos' : 'Fazer upgrade'}
          </Link>
        )}
        {data?.hasStripe && planKey !== 'SCALE' && (
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"
          >
            <ArrowRight className="w-4 h-4" />
            Fazer upgrade
          </Link>
        )}
      </div>
    </div>
  )
}
