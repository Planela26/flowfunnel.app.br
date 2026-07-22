'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Clock, ArrowRight } from 'lucide-react'

function CheckoutPendingInner() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'START'
  const [countdown, setCountdown] = useState(10)

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento pendente</h1>
        <p className="text-gray-600 mb-4">
          Seu pagamento para o plano <strong className="text-blue-700">{plan}</strong> está sendo processado.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Assim que confirmado, seu plano será ativado automaticamente.
          <br />
          Redirecionando em <span className="font-bold text-blue-600">{countdown}s</span>
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

export default function CheckoutPending() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50" />}>
      <CheckoutPendingInner />
    </Suspense>
  )
}
