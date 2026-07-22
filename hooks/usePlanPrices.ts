import { useState, useEffect } from 'react'

interface PlanPrice {
  plan: string
  price: number
  name: string
}

export function usePlanPrices() {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/plan-prices')
      .then(r => r.json())
      .then(data => {
        const priceMap: Record<string, number> = {}
        data.prices?.forEach((p: PlanPrice) => {
          priceMap[p.plan] = p.price
        })
        setPrices(priceMap)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar preços')
        setLoading(false)
      })
  }, [])

  return { prices, loading, error }
}
