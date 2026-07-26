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
 *
 * SAVE sem debounce: ao adicionar/remover card, POST imediato. O bug original
 * vinha de o SAVE debounced (600ms) ser morto pelo fetch inicial do servidor
 * (que retornava um snapshot stale e zerava lastServerSavedJson); o timer
 * pendente era cancelado no cleanup sem nunca disparar. Como add/remove são
 * ações de baixa frequência (≤1 por segundo), o POST imediato é seguro.
 *
 * SAVE com debounce é apenas para POSIÇÕES (drag-and-drop em FunnelFlow) onde
 * uma operação gera dezenas de updates por segundo.
 */
export function useFunnelView(userId: string | undefined) {
  const [visibleIds, setVisibleIds] = useState<string[]>(AVAILABLE_INTEGRATIONS.map(i => i.id))
  const [initialized, setInitialized] = useState(false)
  const lastServerSavedJson = useRef<string | null>(null)

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
          // IMPORTANTE: marcar como "salvo pelo servidor" mesmo quando valid=[]
          // (decisão válida do usuário: ele apagou todos os cards).
          setVisibleIds(valid)
          lastServerSavedJson.current = JSON.stringify(valid)
        }
      }
    } catch { /* ignore */ }
    setInitialized(true)

    // (2) Fonte de verdade no backend. CAPTURA snapshot de visibleIds no
    // início do fetch — se o usuário clicar em apagar/adicionar um card
    // durante o in-flight, NÃO sobrescrevemos com dados stale do servidor.
    ;(async () => {
      try {
        const snapshot = JSON.stringify(visibleIds)
        const res = await fetch('/api/funnel-layout', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (Array.isArray(data?.visibleIds)) {
          const valid = data.visibleIds.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          const serverJson = JSON.stringify(valid)

          if (serverJson === snapshot) {
            // Servidor concorda com o que já temos; marca como "salvo".
            lastServerSavedJson.current = serverJson
          } else if (JSON.stringify(visibleIds) === snapshot) {
            // (a) Servidor tem estado diferente E o usuário não mexeu durante
            // o fetch → aplica verdade do servidor.
            setVisibleIds(valid)
            try { localStorage.setItem(getStorageKey(userId!), JSON.stringify(valid)) } catch {}
            lastServerSavedJson.current = serverJson
          }
          // (b) serverJson !== snapshot E visibleIds !== snapshot:
          // usuário mudou durante o fetch. NÃO mexemos em visibleIds nem em
          // lastServerSavedJson. O SAVE effect (logo abaixo) já detectou a
          // mudança do usuário e fez POST imediato — servidor será atualizado
          // quando a requisição do usuário completar. Mantemos a intenção do
          // usuário como source of truth aqui.
        }
        // data.visibleIds === null OR sem o campo → mantém o que já temos.
      } catch { /* offline → mantém cache local */ }
    })()

    return () => { cancelled = true }
  }, [userId])

  // SAVE: POST IMEDIATO em toda mudança de visibleIds (sem debounce).
  // O pagehide handler serve apenas como rede de segurança caso o fetch
  // imediato não tenha completado antes da aba fechar (keepalive no servidor).
  useEffect(() => {
    if (!userId || !initialized) return
    const json = JSON.stringify(visibleIds)

    // cache local imediato (UX sem flash em reload)
    try { localStorage.setItem(getStorageKey(userId), json) } catch {}

    if (lastServerSavedJson.current === json) return

    lastServerSavedJson.current = json
    void fetch('/api/funnel-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleIds }),
      keepalive: true,
    }).catch(() => {})

    // Pagehide safety net: se o fetch for cancelado por unload antes do
    // round-trip, o segundo POST com keepalive garante a entrega.
    const flush = () => {
      if (lastServerSavedJson.current === 'flushed:' + json) return
      lastServerSavedJson.current = 'flushed:' + json
      void fetch('/api/funnel-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleIds }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', flush)

    return () => {
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
