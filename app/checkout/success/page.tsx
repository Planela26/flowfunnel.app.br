'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

function CheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'START'
  const [countdown, setCountdown] = useState(5)

  // Fire the Meta Pixel Purchase ONLY after the webhook confirmed the payment.
  // We poll the read-once endpoint; it returns the pending purchase (with the
  // same event_id the CAPI used) and clears it. fbq dedups against CAPI by eventID.
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 10

    const poll = async () => {
      if (cancelled) return
      attempts++
      // Wait until fbq is ready BEFORE hitting the read-once endpoint — it clears
      // the pending purchase on read, so consuming it before the Pixel is loaded
      // would drop the event entirely (CAPI still covers it server-side, but we
      // want the Pixel to fire too).
      if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
        if (!cancelled && attempts < maxAttempts) setTimeout(poll, 1500)
        return
      }
      try {
        const res = await fetch('/api/meta/purchase', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const p = data?.purchase
          if (p?.eventId) {
            window.fbq('track', 'Purchase', { value: p.value, currency: p.currency || 'BRL' }, { eventID: p.eventId })
            return
          }
        }
      } catch {
        // ignore — best-effort tracking
      }
      if (!cancelled && attempts < maxAttempts) {
        setTimeout(poll, 1500)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer)
          window.location.href = '/dashboard'
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento confirmado!</h1>
        <p className="text-gray-600 mb-6">
          Seu plano <strong className="text-blue-700">{plan}</strong> foi ativado com sucesso.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Você será redirecionado para o dashboard em <span className="font-bold text-blue-600">{countdown}s</span>
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
        >
          Ir para o dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

export default function CheckoutSuccess() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50" />}>
      <CheckoutSuccessInner />
    </Suspense>
  )
}
