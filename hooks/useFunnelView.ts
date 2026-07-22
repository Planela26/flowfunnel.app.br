'use client'

import { useState, useEffect, useCallback } from 'react'

export type IntegrationCard = {
  id: string
  label: string
  type: 'traffic' | 'funnel' | 'checkout' | 'payment' | 'crm'
  icon: string
  color: string
  borderColor: string
  connectHref?: string
  connectLabel?: string
}

export const AVAILABLE_INTEGRATIONS: IntegrationCard[] = [
  { id: 'facebook', label: 'Meta Ads', type: 'traffic', icon: 'f', color: '#1877f2', borderColor: 'border-blue-500/50', connectHref: '/facebook-connect' },
  { id: 'google', label: 'Google Ads', type: 'traffic', icon: 'G', color: '#ea4335', borderColor: 'border-red-500/50', connectHref: '/settings', connectLabel: 'Configurar Google Ads' },
  { id: 'tiktok', label: 'TikTok Ads', type: 'traffic', icon: '\u266A', color: '#ff0050', borderColor: 'border-pink-500/50', connectHref: '/settings', connectLabel: 'Configurar TikTok Ads' },
  { id: 'whatsapp', label: 'WhatsApp', type: 'funnel', icon: 'W', color: '#25d366', borderColor: 'border-green-500/50' },
  { id: 'hotmart', label: 'Hotmart', type: 'checkout', icon: 'H', color: '#f97316', borderColor: 'border-orange-500/50', connectHref: '/hotmart-connect' },
  { id: 'kiwify', label: 'Kiwify', type: 'checkout', icon: 'K', color: '#10b981', borderColor: 'border-emerald-500/50', connectHref: '/kiwify-connect' },
  { id: 'eduzz', label: 'Eduzz', type: 'checkout', icon: 'E', color: '#6366f1', borderColor: 'border-indigo-500/50', connectHref: '/eduzz-connect' },
  { id: 'monetizze', label: 'Monetizze', type: 'checkout', icon: 'M', color: '#8b5cf6', borderColor: 'border-purple-500/50', connectHref: '/monetizze-connect' },
  { id: 'stripe', label: 'Stripe', type: 'payment', icon: 'S', color: '#635bff', borderColor: 'border-violet-500/50', connectHref: '/settings' },
  { id: 'mercadopago', label: 'Mercado Pago', type: 'payment', icon: 'MP', color: '#00b1ea', borderColor: 'border-cyan-500/50', connectHref: '/settings' },
  { id: 'crm', label: 'CRM', type: 'crm', icon: 'CRM', color: '#64748b', borderColor: 'border-slate-500/50', connectHref: '/settings' },
]

const getStorageKey = (userId: string) => `funnel_view_${userId}`

export function useFunnelView(userId: string | undefined) {
  const [visibleIds, setVisibleIds] = useState<string[]>(AVAILABLE_INTEGRATIONS.map(i => i.id))
  const [initialized, setInitialized] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(getStorageKey(userId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          // Sanitize: only keep IDs that exist in AVAILABLE_INTEGRATIONS
          const validIds = parsed.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          setVisibleIds(validIds.length > 0 ? validIds : AVAILABLE_INTEGRATIONS.map(i => i.id))
          setInitialized(true)
          return
        }
      }
    } catch {
      // ignore
    }
    // Default: already set in useState, just mark initialized
    setInitialized(true)
  }, [userId])

  // Save to localStorage whenever visibleIds changes
  useEffect(() => {
    if (!userId || !initialized) return
    localStorage.setItem(getStorageKey(userId), JSON.stringify(visibleIds))
  }, [visibleIds, userId, initialized])

  const addCard = useCallback((id: string) => {
    setVisibleIds(prev => {
      if (prev.includes(id)) return prev
      return [...prev, id]
    })
  }, [])

  const removeCard = useCallback((id: string) => {
    setVisibleIds(prev => prev.filter(x => x !== id))
  }, [])

  const isVisible = useCallback((id: string) => visibleIds.includes(id), [visibleIds])

  const getAvailableToAdd = useCallback(() => {
    return AVAILABLE_INTEGRATIONS.filter(i => !visibleIds.includes(i.id))
  }, [visibleIds])

  const getVisibleCards = useCallback(() => {
    return visibleIds
      .map(id => AVAILABLE_INTEGRATIONS.find(i => i.id === id))
      .filter(Boolean) as IntegrationCard[]
  }, [visibleIds])

  return {
    visibleIds,
    initialized,
    addCard,
    removeCard,
    isVisible,
    getAvailableToAdd,
    getVisibleCards,
  }
}
