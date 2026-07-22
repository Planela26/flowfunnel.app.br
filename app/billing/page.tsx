'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CreditCard, Zap, Star, Rocket, CheckCircle, ArrowRight,
  Calendar, AlertCircle, Loader2, ExternalLink, TrendingUp, Shield
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'

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

interface UsageData {
  used: number
  limit: number
  unlimited: boolean
  percent: number
  resetDate: string
}

const PLANS = [
  {
    key: 'START',
    name: 'START',
    price: 'R$ 97',
    period: '/mês',
    icon: Star,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    priceId: 'price_1TGC9uHozdjtX6AC911xvx53',
    features: [
      '1.000 conversas/mês',
      'WhatsApp + Facebook Ads',
      'Hotmart + Kiwify',
      'Análise ChatGPT-4',
      'Relatórios e Leads',
      'Suporte por email',
    ],
  },
  {
    key: 'PRO',
    name: 'PRO',
    price: 'R$ 147',
    period: '/mês',
    icon: Star,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-700',
    buttonColor: 'bg-indigo-600 hover:bg-indigo-700',
    priceId: 'price_1TGC9vHozdjtX6ACKP2DaHka',
    popular: true,
    features: [
      '3.000 conversas/mês',
      'Tudo do START',
      'Exportação CSV avançada',
      'Metas e objetivos',
      'Alertas automáticos',
      'Suporte prioritário',
    ],
  },
  {
    key: 'SCALE',
    name: 'SCALE',
    price: 'R$ 297',
    period: '/mês',
    icon: Rocket,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-700',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    priceId: 'price_1TGC9vHozdjtX6ACbY8LxBeG',
    features: [
      'Conversas ILIMITADAS',
      'Tudo do PRO',
      'Múltiplos workspaces',
      'API de acesso',
      'Relatório white-label',
      'Suporte VIP (WhatsApp)',
    ],
  },
]

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Grátis', START: 'START', PRO: 'PRO', SCALE: 'SCALE',
}

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    Promise.all([
      fetch('/api/stripe/subscription').then(r => r.json()),
      fetch('/api/usage').then(r => r.json()),
    ]).then(([s, u]) => {
      setSub(s)
      setUsage(u)
    }).catch(() => {}).finally(() => setLoadingSub(false))
  }, [status])

  // O Portal do Stripe (gerenciar assinatura) é hospedado pelo Stripe e precisa
  // navegar pra fora — em iframe, abre em nova aba; fora, navega direto.
  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        const inIframe = typeof window !== 'undefined' && window.top !== window.self
        if (inIframe) window.open(data.url, '_blank', 'noopener,noreferrer')
        else window.location.href = data.url
      }
    } catch {}
    setPortalLoading(false)
  }

  // Upgrade usa o checkout embarcado (/checkout?plan=X) — Stripe Elements dentro do SaaS.
  const handleUpgrade = (planKey: string) => {
    setUpgradeLoading(planKey)
    router.push(`/checkout?plan=${planKey}`)
  }

  if (status === 'loading' || loadingSub) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        <DashboardSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    )
  }

  const currentPlan = sub?.plan || 'FREE'
  const currentPlanIndex = PLANS.findIndex(p => p.key === currentPlan)
  const subStatus = sub?.subscription?.status || 'free'
  const cancelAtEnd = sub?.subscription?.cancelAtPeriodEnd
  const periodEnd = sub?.subscription?.currentPeriodEnd
    ? new Date(sub.subscription.currentPeriodEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              Assinatura e Planos
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gerencie sua assinatura e veja seu consumo mensal.
            </p>
          </div>

          {/* Plano atual + uso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Plano atual */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Plano Atual
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {PLAN_LABELS[currentPlan] || currentPlan}
                  </p>
                  <p className={`text-xs font-medium ${
                    subStatus === 'active' || subStatus === 'trialing' ? 'text-green-600 dark:text-green-400'
                    : subStatus === 'past_due' ? 'text-amber-600 dark:text-amber-400'
                    : subStatus === 'canceled' ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {subStatus === 'active' ? '● Ativa'
                      : subStatus === 'trialing' ? '● Em trial'
                      : subStatus === 'past_due' ? '⚠ Pagamento pendente'
                      : subStatus === 'canceled' ? '✕ Cancelada'
                      : '● Plano gratuito'}
                  </p>
                </div>
              </div>

              {cancelAtEnd && periodEnd && (
                <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Cancela em {periodEnd}. Acesso até esta data.
                </div>
              )}

              {periodEnd && !cancelAtEnd && (
                <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Próxima cobrança: {periodEnd}
                </div>
              )}

              {sub?.hasStripe && (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium py-2.5 px-4 rounded-lg transition"
                >
                  {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Gerenciar no Stripe
                </button>
              )}
            </div>

            {/* Uso do mês */}
            {usage && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Uso em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                </p>
                {usage.unlimited ? (
                  <div className="flex flex-col items-center justify-center h-24 gap-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Conversas Ilimitadas</p>
                    <p className="text-xs text-gray-400">{usage.used.toLocaleString('pt-BR')} neste mês</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">
                        {usage.used.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-sm text-gray-400 mb-1">/ {usage.limit.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-700 mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usage.percent >= 100 ? 'bg-red-500'
                          : usage.percent >= 80 ? 'bg-amber-500'
                          : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, usage.percent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{usage.percent}% utilizado</span>
                      <span>Renova {new Date(usage.resetDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Comparativo de planos */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              {currentPlan === 'SCALE' ? 'Seu plano inclui tudo' : 'Faça upgrade para crescer mais'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Escolha o plano ideal para o volume do seu funil.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const Icon = plan.icon
                const isCurrent = currentPlan === plan.key
                const isDowngrade = currentPlanIndex > PLANS.findIndex(p => p.key === plan.key)

                return (
                  <div
                    key={plan.key}
                    className={`relative rounded-2xl border p-5 flex flex-col transition ${
                      plan.popular ? 'shadow-lg' : ''
                    } ${isCurrent
                      ? 'border-2 border-blue-500 dark:border-blue-400 ' + plan.bg
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Mais Popular
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Plano Atual
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <Icon className={`w-5 h-5 ${plan.color}`} />
                      <span className={`font-bold text-base ${plan.color}`}>{plan.name}</span>
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                      <span className="text-sm text-gray-400">{plan.period}</span>
                    </div>

                    <ul className="space-y-2 mb-5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <div className="text-center py-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                        ✓ Plano ativo
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.key)}
                        disabled={!!upgradeLoading || isDowngrade}
                        className={`w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition ${
                          isDowngrade
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : plan.buttonColor
                        }`}
                      >
                        {upgradeLoading === plan.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            {isDowngrade ? 'Downgrade via Stripe' : 'Fazer Upgrade'}
                            {!isDowngrade && <ArrowRight className="w-4 h-4" />}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Garantia */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <span>
              <strong>Garantia de 7 dias.</strong> Se não ficar satisfeito por qualquer motivo, devolvemos 100% do valor. Sem perguntas.
            </span>
          </div>

        </div>
      </main>
    </div>
  )
}
