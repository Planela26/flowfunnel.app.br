'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default function GracePeriodBanner() {
  const [graceDays, setGraceDays] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.inGracePeriod && data?.graceDaysLeft != null) {
          setGraceDays(data.graceDaysLeft)
        }
      })
      .catch(() => {})
  }, [])

  if (graceDays === null || dismissed) return null

  const urgent = graceDays <= 1

  return (
    <div
      className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm ${
        urgent
          ? 'bg-red-900/80 border-b border-red-600/40'
          : 'bg-orange-900/60 border-b border-orange-600/30'
      }`}
    >
      <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${urgent ? 'text-red-400' : 'text-orange-400'}`} />
      <span className={`flex-1 font-medium ${urgent ? 'text-red-200' : 'text-orange-200'}`}>
        {urgent
          ? 'Pagamento pendente — você deixará de receber novos dados em breve. Regularize agora!'
          : `Falha no pagamento. Você deixará de receber novos dados e leads em ${graceDays} dia${graceDays !== 1 ? 's' : ''}.`}
      </span>
      <Link
        href="/billing"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
          urgent
            ? 'bg-red-500 hover:bg-red-400 text-white'
            : 'bg-orange-500 hover:bg-orange-400 text-white'
        }`}
      >
        <CreditCard className="w-3 h-3" />
        Regularizar
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-500 hover:text-white transition flex-shrink-0"
        title="Fechar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
