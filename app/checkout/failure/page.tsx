'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react'

function CheckoutFailureInner() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'START'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento não concluído</h1>
        <p className="text-gray-600 mb-6">
          Houve um problema ao processar seu pagamento. Nenhuma cobrança foi realizada.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={`/checkout?plan=${plan}`}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 font-medium px-6 py-3 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar aos planos
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutFailure() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50" />}>
      <CheckoutFailureInner />
    </Suspense>
  )
}
