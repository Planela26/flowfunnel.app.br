'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function AffiliateTracker() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (!ref) return

    const code = ref.toUpperCase().trim()

    fetch('/api/affiliates/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.valid) return
        // A persistência da atribuição não é mais responsabilidade do
        // cliente — /api/affiliates/click grava o cookie ff_attr (httpOnly,
        // assinado) na resposta (Fase 3, §18.3 do desenho).
        return fetch('/api/affiliates/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateId: data.affiliate.id }),
        })
      })
      .catch(() => {})
  }, [searchParams])

  return null
}
