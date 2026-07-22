'use client'

import { Suspense } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePlan } from '@/components/usePlan'
import { Lock, Zap, TrendingUp, CreditCard, LogOut, ArrowRight } from 'lucide-react'

const PLAN_INFO: Record<string, { label: string; price: string; color: string }> = {
  START: { label: 'START', price: 'R$97/mês', color: 'from-blue-500 to-blue-700' },
  PRO:   { label: 'PRO',   price: 'R$147/mês', color: 'from-blue-600 to-indigo-700' },
  SCALE: { label: 'SCALE', price: 'R$297/mês', color: 'from-indigo-600 to-purple-700' },
}

function SubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { info, loading } = usePlan()

  const isTrialExpired = searchParams?.get('trial') === 'expired'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const planKey = (info.trialPlan ?? 'PRO').toUpperCase()
  const planInfo = PLAN_INFO[planKey] ?? PLAN_INFO['PRO']

  // Trial expired view
  if (isTrialExpired || info.trialExpired) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Seu teste grátis acabou</h1>
                <p className="text-sm text-red-400">Assine o {planInfo.label} para continuar</p>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6">
              <p className="text-sm text-gray-300 leading-relaxed">
                Os 7 dias do seu teste gratuito do Plano{' '}
                <strong className="text-white">{planInfo.label}</strong> expiraram.
                Assine agora para continuar visualizando seus dados, integrações e relatórios.
              </p>

              <div className={`rounded-xl bg-gradient-to-br ${planInfo.color} p-5 text-white`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-5 h-5" />
                  <span className="text-lg font-bold">Plano {planInfo.label}</span>
                </div>
                <div className="text-2xl font-black text-center">{planInfo.price}</div>
                <div className="text-xs text-white/70 text-center">renovação automática mensal</div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/checkout?plan=${planKey}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition"
                >
                  <Zap className="w-4 h-4" />
                  Assinar Plano {planInfo.label}
                </button>

                <button
                  onClick={() => router.push('/pricing')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition border border-gray-700"
                >
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  Ver todos os planos
                </button>

                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-500 hover:text-red-400 rounded-xl font-medium text-sm transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Subscription inactive view (paid plan expired/cancelled)
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Assinatura pendente</h1>
              <p className="text-sm text-red-400">Acesso temporariamente suspenso</p>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6">
            <p className="text-sm text-gray-300 leading-relaxed">
              Sua assinatura está inativa. Regularize o pagamento para continuar
              utilizando o FlowFunnel e não perder acesso aos seus dados, integrações
              e relatórios.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/billing')}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Atualizar pagamento
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => router.push('/pricing')}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition border border-gray-700"
              >
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  Assinar novamente
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-500 hover:text-red-400 rounded-xl font-medium text-sm transition"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-950/50 border-t border-gray-800">
            <p className="text-[11px] text-gray-600 text-center">
              Dúvidas? Entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionRequiredPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}
