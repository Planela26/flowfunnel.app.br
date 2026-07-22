'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Shield, CreditCard, Lock, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const PLAN_LABELS: Record<string, string> = {
  START: 'START', PRO: 'PRO', SCALE: 'SCALE',
}
const PLAN_PRICES: Record<string, string> = {
  START: 'R$ 97', PRO: 'R$ 147', SCALE: 'R$ 297',
}

// ── Inner form that uses Stripe hooks (must be inside <Elements>) ─────────────
function TrialSetupForm({
  subscriptionId,
  plan,
  trialEndsAt,
  onSuccess,
}: {
  subscriptionId: string
  plan: string
  trialEndsAt: string | null
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endsStr = trialEndsAt
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      }).format(new Date(trialEndsAt))
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    try {
      const { error: stripeError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/activate-trial/confirm`,
        },
        redirect: 'if_required',
      })

      if (stripeError) {
        setError(stripeError.message ?? 'Erro ao validar cartão.')
        setSubmitting(false)
        return
      }

      // Card confirmed — activate trial on our server
      const res = await fetch('/api/stripe/activate-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao ativar teste.')
        setSubmitting(false)
        return
      }

      // Meta Pixel: StartTrial — same event_id as the CAPI event (dedup).
      if (typeof window !== 'undefined' && typeof window.fbq === 'function' && data.meta?.startTrial?.eventId) {
        window.fbq('track', 'StartTrial', { value: data.meta.startTrial.value, currency: data.meta.startTrial.currency || 'BRL' }, { eventID: data.meta.startTrial.eventId })
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: { name: 'auto' } },
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {endsStr && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Cobrança automática em {endsStr}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {PLAN_PRICES[plan] ?? ''}/mês · Cancele antes para não ser cobrado
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ativando teste...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Ativar 7 dias grátis — {PLAN_LABELS[plan] ?? plan}
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
        <Lock className="w-3.5 h-3.5" />
        <span>Pagamento 100% seguro via Stripe. Seus dados são criptografados.</span>
      </div>
    </form>
  )
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ plan }: { plan: string }) {
  const router = useRouter()
  const { update } = useSession()

  useEffect(() => {
    update().then(() => {
      setTimeout(() => router.push('/dashboard'), 2500)
    })
  }, [])

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        Teste ativado com sucesso!
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-2">
        Seu plano <strong>{PLAN_LABELS[plan] ?? plan}</strong> está ativo por 7 dias.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-600">
        Redirecionando para o dashboard...
      </p>
    </div>
  )
}

// ── Main page (inner, with Suspense) ─────────────────────────────────────────
function ActivateTrialInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: session, status } = useSession()

  const plan = (params.get('plan') ?? 'START').toUpperCase()
  const planLabel = PLAN_LABELS[plan] ?? plan

  const [stripePromise, setStripePromise] = useState<any>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyActive, setAlreadyActive] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/activate-trial?plan=${plan}`)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return

    async function init() {
      try {
        // Check current plan status
        const planRes = await fetch('/api/plan')
        const planData = await planRes.json()

        if (planData.trialStatus === 'active') {
          setAlreadyActive(true)
          setTimeout(() => router.push('/dashboard'), 2000)
          return
        }

        if (planData.trialStatus === 'converted') {
          router.push('/billing')
          return
        }

        // Load Stripe
        const configRes = await fetch('/api/stripe/config')
        const configData = await configRes.json()
        if (!configData.publishableKey) {
          setError('Configuração de pagamento indisponível.')
          setLoading(false)
          return
        }
        const sp = loadStripe(configData.publishableKey)
        setStripePromise(sp)

        // Create trial subscription
        const trialRes = await fetch('/api/stripe/create-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        })
        const trialData = await trialRes.json()

        if (!trialRes.ok) {
          setError(trialData.error || 'Erro ao criar assinatura de teste.')
          setLoading(false)
          return
        }

        setSubscriptionId(trialData.subscriptionId)
        setTrialEndsAt(trialData.trialEndsAt)

        if (trialData.alreadyHasPaymentMethod) {
          // Subscription already has PM — just activate
          const activateRes = await fetch('/api/stripe/activate-trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: trialData.subscriptionId }),
          })
          if (activateRes.ok) {
            const ad = await activateRes.json().catch(() => ({} as any))
            if (typeof window !== 'undefined' && typeof window.fbq === 'function' && ad.meta?.startTrial?.eventId) {
              window.fbq('track', 'StartTrial', { value: ad.meta.startTrial.value, currency: ad.meta.startTrial.currency || 'BRL' }, { eventID: ad.meta.startTrial.eventId })
            }
            setSuccess(true)
          } else {
            const d = await activateRes.json()
            setError(d.error || 'Erro ao ativar teste.')
          }
          setLoading(false)
          return
        }

        setClientSecret(trialData.clientSecret)
        setLoading(false)
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar configurações.')
        setLoading(false)
      }
    }

    init()
  }, [status, plan])

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (alreadyActive) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Seu teste já está ativo!
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Redirecionando para o dashboard...</p>
      </div>
    )
  }

  if (success) {
    return <SuccessScreen plan={plan} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Clock className="w-4 h-4" />
            7 dias grátis — Plano {planLabel}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Adicione seu cartão
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Nenhum valor cobrado durante o período de teste.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: <Shield className="w-4 h-4" />, label: 'Sem cobrança agora' },
            { icon: <Clock className="w-4 h-4" />, label: '7 dias completos' },
            { icon: <CheckCircle className="w-4 h-4" />, label: 'Cancele quando quiser' },
          ].map((b, i) => (
            <div key={i} className="flex flex-col items-center gap-2 bg-white dark:bg-gray-900 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                {b.icon}
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{b.label}</span>
            </div>
          ))}
        </div>

        {/* Card form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
          {error ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setError(null); setLoading(true); window.location.reload() }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl text-sm"
                >
                  Tentar novamente
                </button>
                <Link
                  href="/pricing"
                  className="flex-1 px-4 py-2.5 text-center text-gray-500 dark:text-gray-400 text-sm"
                >
                  Ver planos
                </Link>
              </div>
            </div>
          ) : stripePromise && clientSecret && subscriptionId ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                    borderRadius: '8px',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  },
                },
              }}
            >
              <TrialSetupForm
                subscriptionId={subscriptionId}
                plan={plan}
                trialEndsAt={trialEndsAt}
                onSuccess={() => setSuccess(true)}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Já tem uma conta paga?{' '}
          <Link href="/billing" className="text-blue-500 hover:underline">
            Ver minha assinatura
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ActivateTrialPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <ActivateTrialInner />
    </Suspense>
  )
}
