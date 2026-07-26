'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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
  { id: 'crm', label: 'CRM', type: 'crm', icon: 'CRM', color: '#64748b', borderColor: 'border-slate-500/50', connectHref: '/settings' },
]

const getStorageKey = (userId: string) => `funnel_view_${userId}`

/**
 * Persistência do funil:
 * - FONTE DE VERDADE: banco de dados (User.funnelVisibleIds via /api/funnel-layout).
 *   Sincroniza entre navegadores/dispositivos: apagar um card em qualquer um
 *   faz desaparecer em todos.
 * - localStorage: cache para o primeiro render não dar flash ("UX sem flicker"),
 *   e fallback se a chamada ao backend falhar (offline).
 *
 * Regra de ouro para evitar o bug que o usuário reportou:
 * - Banco diz null OU {} → nunca mostramos o default de AVAILABLE_INTEGRATIONS se
 *   o localStorage tiver um conjunto parcial salvo localmente.
 * - "primeiro acesso" = banco diz null E localStorage vazio → mostrar todos (default).
 */
export function useFunnelView(userId: string | undefined) {
  const [visibleIds, setVisibleIds] = useState<string[]>(AVAILABLE_INTEGRATIONS.map(i => i.id))
  const [initialized, setInitialized] = useState(false)
  const lastServerSavedJson = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // LOAD: pinta cache local imediatamente, depois busca a verdade no backend.
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    // (1) Local cache primeiro — render instantâneo sem flash.
    try {
      const raw = localStorage.getItem(getStorageKey(userId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          if (valid.length > 0) {
            setVisibleIds(valid)
            lastServerSavedJson.current = JSON.stringify(valid)
          }
        }
      }
    } catch { /* ignore */ }
    setInitialized(true)

    // (2) Fonte de verdade no backend. Sobrescreve o cache se divergir.
    ;(async () => {
      try {
        const res = await fetch('/api/funnel-layout', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (Array.isArray(data?.visibleIds)) {
          const valid = data.visibleIds.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          // Só sobrescreve se o backend realmente traz o que ele salvou
          // (evita default fantasma em SSR/cache).
          if (JSON.stringify(valid) !== lastServerSavedJson.current) {
            setVisibleIds(valid)
            try { localStorage.setItem(getStorageKey(userId!), JSON.stringify(valid)) } catch {}
          }
          lastServerSavedJson.current = JSON.stringify(valid)
        }
        // data.visibleIds === null OR sem o campo → mantém o que já temos.
      } catch { /* offline → mantém cache local */ }
    })()

    return () => { cancelled = true }
  }, [userId])

  // SAVE: debounce 600ms; flush imediato em pagehide (keepalive).
  useEffect(() => {
    if (!userId || !initialized) return
    const json = JSON.stringify(visibleIds)

    // cache local imediato
    try { localStorage.setItem(getStorageKey(userId), JSON.stringify(visibleIds)) } catch {}

    if (lastServerSavedJson.current === json) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      lastServerSavedJson.current = json
      void fetch('/api/funnel-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleIds }),
        keepalive: true,
      }).catch(() => {})
    }, 600)

    const flush = () => {
      if (lastServerSavedJson.current === json) return
      lastServerSavedJson.current = json
      void fetch('/api/funnel-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleIds }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', flush)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      window.removeEventListener('pagehide', flush)
    }
  }, [visibleIds, userId, initialized])

  const addCard = useCallback((id: string) => {
    setVisibleIds(prev => (prev.includes(id) ? prev : [...prev, id]))
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
