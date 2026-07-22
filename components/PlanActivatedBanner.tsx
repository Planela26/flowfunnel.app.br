'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Clock } from 'lucide-react'

type State = 'activating' | 'active' | 'processing' | null

export default function PlanActivatedBanner() {
  const searchParams = useSearchParams()
  const [plan, setPlan] = useState<string | null>(null)
  const [state, setState] = useState<State>(null)

  useEffect(() => {
    const p = searchParams.get('plan_activated')
    const subId = searchParams.get('subscription_id')
    const redirectStatus = searchParams.get('redirect_status')

    if (!p) return
    const planKey = p.toUpperCase()
    setPlan(planKey)

    // Clean all Stripe and our custom URL params
    const url = new URL(window.location.href)
    ;['plan_activated', 'subscription_id', 'session_id',
      'payment_intent', 'payment_intent_client_secret',
      'redirect_status', 'setup_intent', 'setup_intent_client_secret',
    ].forEach(k => url.searchParams.delete(k))
    window.history.replaceState({}, '', url.toString())

    // Async payment (PIX, Boleto) — show "processing" message
    if (redirectStatus === 'processing') {
      setState('processing')
      return
    }

    // Direct activation via subscription_id (bypasses webhooks)
    if (subId) {
      setState('activating')
      fetch('/api/stripe/activate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.plan) setPlan(data.plan)
          setState('active')
        })
        .catch(err => {
          console.error('Erro ao ativar plano:', err)
          setState('active') // Still show the banner even if activation call fails (webhook may handle it)
        })
    } else {
      setState('active')
    }
  }, [searchParams])

  if (!plan || !state) return null

  return (
    <div className={`text-white px-4 py-3.5 flex items-center justify-between shadow-md ${
      state === 'processing' ? 'bg-yellow-600' : 'bg-green-600'
    }`}>
      <div className="flex items-center gap-3">
        {state === 'activating' ? (
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
        ) : state === 'processing' ? (
          <Clock className="w-5 h-5 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <span className="font-semibold text-sm">
          {state === 'activating' && 'Ativando seu plano...'}
          {state === 'processing' && (
            <>⏳ Pagamento do plano <strong>{plan}</strong> em processamento. Seu acesso será liberado em breve.</>
          )}
          {state === 'active' && (
            <>🎉 Plano <strong>{plan}</strong> ativado com sucesso! Bem-vindo ao FlowFunnel.</>
          )}
        </span>
      </div>
      {state !== 'activating' && (
        <button onClick={() => { setPlan(null); setState(null) }} className="text-white/80 hover:text-white text-xl leading-none px-2 ml-4 flex-shrink-0">×</button>
      )}
    </div>
  )
}
