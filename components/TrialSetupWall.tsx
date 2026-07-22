'use client'

import { CreditCard, Shield, Clock, ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePlan } from './usePlan'

const PLAN_LABELS: Record<string, string> = {
  START: 'START', PRO: 'PRO', SCALE: 'SCALE',
}
const PLAN_PRICES: Record<string, string> = {
  START: 'R$ 97', PRO: 'R$ 147', SCALE: 'R$ 297',
}

export default function TrialSetupWall() {
  const { info, loading } = usePlan()
  const router = useRouter()
  const { data: session } = useSession()
  const [dismissed, setDismissed] = useState(false)

  // Chave por usuário e por sessão — explorar primeiro vale só para a sessão atual,
  // o aviso volta no próximo login para continuar incentivando a ativação.
  const guardKey = session?.user?.id ? `trial_explore:${session.user.id}` : null

  useEffect(() => {
    if (!guardKey) return
    try {
      if (sessionStorage.getItem(guardKey) === '1') setDismissed(true)
    } catch {}
  }, [guardKey])

  if (loading || !info.trialPendingPayment || dismissed) return null

  const plan = info.trialPlan ?? 'START'
  const planLabel = PLAN_LABELS[plan] ?? plan
  const price = PLAN_PRICES[plan] ?? ''

  const exploreFirst = () => {
    if (guardKey) { try { sessionStorage.setItem(guardKey, '1') } catch {} }
    setDismissed(true)
    router.push('/dashboard')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Ative seu teste grátis
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed">
          Para acessar o plano{' '}
          <strong className="text-gray-900 dark:text-white">{planLabel}</strong>,
          adicione um cartão de crédito. Você{' '}
          <strong>não será cobrado</strong> durante os 7 dias de teste.
        </p>

        <div className="space-y-3 mb-8 text-left">
          {[
            { icon: Clock, text: `7 dias grátis com acesso completo ao plano ${planLabel}` },
            { icon: Shield, text: 'Sem cobrança durante o teste — cancele a qualquer momento' },
            { icon: CreditCard, text: `Após os 7 dias: ${price}/mês (pode cancelar antes)` },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3 h-3 text-green-600 dark:text-green-400" />
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <Link
          href={`/activate-trial?plan=${plan}`}
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20"
        >
          <CreditCard className="w-4 h-4" />
          Adicionar cartão e ativar teste
          <ArrowRight className="w-4 h-4" />
        </Link>

        <button
          onClick={exploreFirst}
          className="inline-flex items-center justify-center gap-2 w-full mt-3 px-6 py-3 text-gray-600 dark:text-gray-300 font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
        >
          <Compass className="w-4 h-4" />
          Conhecer a plataforma primeiro
        </button>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-600">
          Pagamento seguro via Stripe. Dados do cartão criptografados.
        </p>
      </div>
    </div>
  )
}
