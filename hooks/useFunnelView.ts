'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type IntegrationCard = {
  id: string
  label: string
  // 'tracking' é a Landing Page: uma ETAPA da jornada, não uma integração.
  // Fica entre o tráfego e o funil, e por isso tem entrada e saída — dá para
  // montar Meta Ads → Landing Page → WhatsApp → Hotmart.
  type: 'traffic' | 'tracking' | 'funnel' | 'checkout' | 'payment' | 'crm'
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
  // Ciano: distinto dos demais (azul Meta, vermelho Google, verde WhatsApp,
  // laranja Hotmart) sem sair da paleta do sistema.
  { id: 'landing', label: 'Landing Page', type: 'tracking', icon: '□', color: '#06b6d4', borderColor: 'border-cyan-500/50', connectHref: '/rastreamento', connectLabel: 'Configurar rastreamento' },
  { id: 'whatsapp', label: 'WhatsApp', type: 'funnel', icon: 'W', color: '#25d366', borderColor: 'border-green-500/50' },
  { id: 'hotmart', label: 'Hotmart', type: 'checkout', icon: 'H', color: '#f97316', borderColor: 'border-orange-500/50', connectHref: '/hotmart-connect' },
  { id: 'kiwify', label: 'Kiwify', type: 'checkout', icon: 'K', color: '#10b981', borderColor: 'border-emerald-500/50', connectHref: '/kiwify-connect' },
  { id: 'eduzz', label: 'Eduzz', type: 'checkout', icon: 'E', color: '#6366f1', borderColor: 'border-indigo-500/50', connectHref: '/eduzz-connect' },
  { id: 'monetizze', label: 'Monetizze', type: 'checkout', icon: 'M', color: '#8b5cf6', borderColor: 'border-purple-500/50', connectHref: '/monetizze-connect' },
  { id: 'stripe', label: 'Stripe', type: 'payment', icon: 'S', color: '#635bff', borderColor: 'border-violet-500/50', connectHref: '/settings' },
  { id: 'crm', label: 'CRM', type: 'crm', icon: 'CRM', color: '#64748b', borderColor: 'border-slate-500/50', connectHref: '/settings' },
]

// A chave inclui o FUNIL. Sem isso, o cache local de um funil era lido pelo
// outro e os cards apareciam com o arranjo errado antes mesmo do servidor
// responder. `conta` cobre o caso sem funil selecionado.
const getStorageKey = (userId: string, workspaceId?: string | null) =>
  `funnel_view_${userId}_${workspaceId ?? 'conta'}`

/**
 * Persistência de cards visíveis do funil.
 *
 * FONTE DE VERDADE: banco de dados via /api/funnel-layout.
 * localStorage: cache para render instantâneo (sem flash no primeiro load).
 *
 * ─── Regras anti-race ────────────────────────────────────────────────────
 *
 * 1. SAVE bloqueado até GET completar (serverLoaded = true).
 *    Sem isso, um browser sem localStorage (Edge, modo privado) dispara POST
 *    com o estado default [todos os 10 cards] ANTES do GET resolver — sobrescrevendo
 *    o estado real do servidor e revertendo deleções feitas em outros browsers.
 *
 * 2. Proteção contra stale closure: usamos `visibleIdsRef` (sempre atual)
 *    e `userActionVersion` (monotônico) para detectar se o usuário mexeu
 *    durante o in-flight sem depender do valor capturado no closure.
 *
 * 3. POST imediato em add/remove (sem debounce): ações de baixa frequência
 *    (≤1/s), seguro ir direto. Posições de drag continuam debounced em
 *    FunnelFlow.tsx.
 */
export function useFunnelView(userId: string | undefined, workspaceId?: string | null) {
  const [visibleIds, setVisibleIds] = useState<string[]>(AVAILABLE_INTEGRATIONS.map(i => i.id))

  // Dois gates separados:
  // - initialized: cache local lido (pode renderizar sem flash)
  // - serverLoaded: GET do servidor completou → SAVE liberado
  const [initialized, setInitialized] = useState(false)
  const [serverLoaded, setServerLoaded] = useState(false)

  // Baseline do que o servidor já tem salvo. SAVE só posta se divergir daqui.
  const lastServerSavedJson = useRef<string | null>(null)

  // Ref que espelha sempre o visibleIds atual (evita stale closure em async).
  const visibleIdsRef = useRef<string[]>(visibleIds)
  useEffect(() => { visibleIdsRef.current = visibleIds }, [visibleIds])

  // Contador que sobe a cada ação intencional do usuário (add/remove).
  // Permite ao GET detectar mudanças durante o in-flight.
  const userActionVersion = useRef(0)

  // ─── LOAD ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    // (1) Cache local primeiro — render sem flash.
    try {
      const raw = localStorage.getItem(getStorageKey(userId, workspaceId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          setVisibleIds(valid)
          // Pré-define o baseline para o SAVE não postar desnecessariamente
          // caso o servidor confirme o mesmo estado.
          lastServerSavedJson.current = JSON.stringify(valid)
        }
      }
    } catch { /* ignore */ }
    setInitialized(true)

    // (2) GET do servidor — fonte de verdade final.
    ;(async () => {
      try {
        const versionAtStart = userActionVersion.current
        const res = await fetch(
          `/api/funnel-layout${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`,
          { cache: 'no-store' },
        )
        if (!res.ok || cancelled) {
          // Mesmo em erro de rede: libera SAVE para não bloquear para sempre.
          // O SAVE vai considerar o estado atual como baseline.
          if (!cancelled) {
            lastServerSavedJson.current = JSON.stringify(visibleIdsRef.current)
            setServerLoaded(true)
          }
          return
        }
        const data = await res.json()
        if (cancelled) return

        // Usuário mexeu durante o in-flight → mantém a intenção do usuário.
        // O SAVE effect já despachou POST imediato; servidor será atualizado.
        // Liberamos serverLoaded para que futuros saves possam acontecer.
        if (userActionVersion.current !== versionAtStart) {
          setServerLoaded(true)
          return
        }

        if (Array.isArray(data?.visibleIds)) {
          const valid = data.visibleIds.filter((id: string) =>
            AVAILABLE_INTEGRATIONS.some(i => i.id === id)
          )
          const serverJson = JSON.stringify(valid)
          const currentJson = JSON.stringify(visibleIdsRef.current)

          if (serverJson !== currentJson) {
            // Servidor tem estado diferente → aplica (outro browser salvou algo).
            setVisibleIds(valid)
            try { localStorage.setItem(getStorageKey(userId!, workspaceId), serverJson) } catch {}
          }
          // Baseline = o que o servidor tem. SAVE só posta se divergir daqui.
          lastServerSavedJson.current = serverJson
        } else {
          // Servidor nunca salvou (null) → trata estado atual como baseline
          // para o SAVE não postar o default [todos os 10] desnecessariamente.
          lastServerSavedJson.current = JSON.stringify(visibleIdsRef.current)
        }
      } catch {
        // Offline / erro → libera SAVE com baseline = estado atual.
        if (!cancelled) lastServerSavedJson.current = JSON.stringify(visibleIdsRef.current)
      } finally {
        if (!cancelled) setServerLoaded(true)
      }
    })()

    return () => { cancelled = true }
  }, [userId, workspaceId])

  // ─── SAVE ────────────────────────────────────────────────────────────────
  // serverLoaded garante que o GET completou antes de qualquer POST.
  // Sem isso, Edge (sem localStorage) postaria [todos os 10 cards] antes
  // do GET resolver e sobrescreveria o estado do servidor.
  useEffect(() => {
    if (!userId || !initialized || !serverLoaded) return

    const json = JSON.stringify(visibleIds)

    // Cache local imediato (UX sem flash em reload).
    try { localStorage.setItem(getStorageKey(userId, workspaceId), json) } catch {}

    // Só posta se divergir do que o servidor já tem.
    if (lastServerSavedJson.current === json) return

    lastServerSavedJson.current = json
    void fetch('/api/funnel-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleIds, workspaceId }),
      keepalive: true,
    }).catch(() => {})

    // Pagehide safety net: se a aba fechar antes do round-trip terminar,
    // o segundo POST (keepalive) garante entrega.
    const flush = () => {
      void fetch('/api/funnel-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleIds, workspaceId }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush) }
  }, [visibleIds, userId, workspaceId, initialized, serverLoaded])

  // ─── Ações do usuário ────────────────────────────────────────────────────
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
