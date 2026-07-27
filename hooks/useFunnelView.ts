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

  // Ref que espelha SEMPRE o valor atual de visibleIds (evita stale closure em
  // handlers async). Atualizado antes de qualquer comparação pós-await.
  const visibleIdsRef = useRef<string[]>(visibleIds)
  useEffect(() => { visibleIdsRef.current = visibleIds }, [visibleIds])

  // Contador monotônico que sobe a cada ação INTENCIONAL do usuário
  // (addCard / removeCard). Permite que o fetch inicial detecte se o
  // usuário mexeu durante o in-flight sem depender de closures stale.
  const userActionVersion = useRef(0)

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
          // Marca como "já visto pelo servidor" para o SAVE effect não
          // disparar POST desnecessário ao inicializar.
          setVisibleIds(valid)
          lastServerSavedJson.current = JSON.stringify(valid)
        }
      }
    } catch { /* ignore */ }
    setInitialized(true)

    // (2) Fonte de verdade no backend.
    // PROTEÇÃO CONTRA STALE-CLOSURE + RACE:
    //   - Capturamos userActionVersion.current ANTES do await.
    //   - Após o await, comparamos com o valor atual do ref.
    //   - Se divergir → usuário fez add/remove durante o fetch → mantemos
    //     o estado do usuário (o SAVE effect já despachou POST imediato).
    ;(async () => {
      try {
        const versionAtStart = userActionVersion.current
        const res = await fetch('/api/funnel-layout', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return

        // Usuário mudou algo durante o in-flight → não sobrescrevemos.
        if (userActionVersion.current !== versionAtStart) return

        if (Array.isArray(data?.visibleIds)) {
          const valid = data.visibleIds.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          const serverJson = JSON.stringify(valid)
          const currentJson = JSON.stringify(visibleIdsRef.current)

          if (serverJson !== currentJson) {
            // Servidor tem estado diferente do local (outra aba adicionou/removeu
            // um card) → aplica a verdade do servidor.
            setVisibleIds(valid)
            try { localStorage.setItem(getStorageKey(userId!), serverJson) } catch {}
          }
          // Marca como salvo em ambos os casos (igual ou diferente).
          lastServerSavedJson.current = serverJson
        }
        // data.visibleIds === null OR sem o campo → mantém o que já temos.
      } catch { /* offline → mantém cache local */ }
    })()

    return () => { cancelled = true }
  }, [userId])

  // SAVE: POST IMEDIATO em toda mudança de visibleIds (sem debounce).
  // add/remove-card são ações de baixa frequência (≤1/s); safe ir direto.
  // Posições de drag permanecem debounced em FunnelFlow.tsx.
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

    // Pagehide safety net: se a aba fechar antes do round-trip terminar,
    // o segundo POST (keepalive=true) garante a entrega pelo browser.
    const flush = () => {
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
    userActionVersion.current += 1
    setVisibleIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const removeCard = useCallback((id: string) => {
    userActionVersion.current += 1
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
