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
        localStorage.setItem('affiliate_code', data.affiliate.code)
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
