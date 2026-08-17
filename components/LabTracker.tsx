'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Rastreamento do funil próprio do FlowSara — anúncio → landing → checkout.
 *
 * O tracker.js público existe para o site DO CLIENTE. Este componente cobre o
 * NOSSO site, que é uma aplicação Next e não precisa de script externo: roda
 * como componente e conversa com /api/track/self, que resolve a conta Owner no
 * servidor (nenhum identificador de conta viaja no navegador).
 *
 * Reaproveita o mesmo modelo de identidade do tracker público —
 * visitor → sessão → lead → eventos — e grava nas mesmas tabelas. Não há
 * segundo sistema de identificação.
 */

const K_VISITOR = 'fs_lab_visitor'
const K_LEAD = 'fs_lab_lead'
const K_SESSION = 'fs_lab_session'
const SESSAO_TTL = 30 * 60 * 1000

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
const CLICK_IDS = ['fbclid', 'gclid', 'ttclid', 'msclkid']

// Macros que a Meta substitui na URL do anúncio. Também aceitamos nomes
// genéricos, para Google e TikTok — a coluna guarda só um identificador.
const CRIATIVO = {
  campaign_id: ['fs_campaign_id', 'campaign_id', 'utm_campaign_id'],
  adset_id: ['fs_adset_id', 'adset_id', 'utm_adset_id'],
  ad_id: ['fs_ad_id', 'ad_id', 'utm_ad_id'],
}

function ler(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function gravar(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* modo privado */ }
}
function novoId(p: string) {
  return p + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12)
}

/** Persiste na primeira visita e devolve nas seguintes: a origem se perde na
 *  navegação interna, mas a jornada continua sendo da mesma campanha. */
function capturarOuLembrar(qs: URLSearchParams, chaves: string[], prefixo: string) {
  const out: Record<string, string> = {}
  for (const k of chaves) {
    const daUrl = qs.get(k)
    if (daUrl) {
      gravar(prefixo + k, daUrl)
      out[k] = daUrl
    } else {
      const guardado = ler(prefixo + k)
      if (guardado) out[k] = guardado
    }
  }
  return out
}

export default function LabTracker() {
  const pathname = usePathname()
  const enviados = useRef<Set<string>>(new Set())
  const identidade = useRef<{ leadId: string; visitorId: string; sessionId: string } | null>(null)

  // Resolve a identidade uma vez por carregamento.
  if (typeof window !== 'undefined' && !identidade.current) {
    const visitorId = ler(K_VISITOR) || novoId('v_')
    gravar(K_VISITOR, visitorId)
    const leadId = ler(K_LEAD) || novoId('l_')
    gravar(K_LEAD, leadId)

    let sessionId = ''
    try {
      const bruto = ler(K_SESSION)
      if (bruto) {
        const s = JSON.parse(bruto)
        if (s?.id && Date.now() - (s.t || 0) < SESSAO_TTL) sessionId = s.id
      }
    } catch { /* ignore */ }
    if (!sessionId) sessionId = novoId('s_')
    gravar(K_SESSION, JSON.stringify({ id: sessionId, t: Date.now() }))

    identidade.current = { leadId, visitorId, sessionId }
  }

  const enviar = (evento: string, meta?: Record<string, unknown>) => {
    const id = identidade.current
    if (!id) return

    // Um evento por página por carregamento: sem isso, o listener de scroll
    // dispararia o mesmo degrau dezenas de vezes e inflaria o funil.
    const chave = `${evento}:${pathname}`
    if (enviados.current.has(chave)) return
    enviados.current.add(chave)

    try {
      const qs = new URLSearchParams(window.location.search)
      const utm = capturarOuLembrar(qs, UTM_KEYS, 'fs_lab_')
      const click_ids = capturarOuLembrar(qs, CLICK_IDS, 'fs_lab_')

      const creative: Record<string, string> = {}
      for (const [campo, aliases] of Object.entries(CRIATIVO)) {
        for (const a of aliases) {
          const v = qs.get(a) || ler('fs_lab_' + a)
          if (v) { gravar('fs_lab_' + a, v); creative[campo] = v; break }
        }
      }

      gravar(K_SESSION, JSON.stringify({ id: id.sessionId, t: Date.now() }))

      const corpo = JSON.stringify({
        lead_id: id.leadId,
        visitor_id: id.visitorId,
        session_id: id.sessionId,
        event: evento,
        url: window.location.href,
        referrer: document.referrer || null,
        utm,
        click_ids,
        creative,
        meta: meta ?? null,
      })

      // sendBeacon sobrevive à navegação — é o que garante o registro do
      // cta_click, que acontece exatamente quando a página está saindo.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/self', new Blob([corpo], { type: 'application/json' }))
        return
      }
      fetch('/api/track/self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo,
        keepalive: true,
      }).catch(() => {})
    } catch { /* rastreamento nunca quebra a página */ }
  }

  // page_view e checkout_view a cada rota
  useEffect(() => {
    enviados.current = new Set()
    enviar(pathname?.startsWith('/checkout') ? 'checkout_view' : 'page_view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Profundidade de leitura — responde "a pessoa leu ou só abriu?"
  useEffect(() => {
    const marcos: Array<[number, string]> = [
      [25, 'scroll_25'], [50, 'scroll_50'], [60, 'scroll_60'], [75, 'scroll_75'], [90, 'scroll_90'],
    ]
    const aoRolar = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - window.innerHeight
      if (total <= 0) return
      const pct = ((window.scrollY || doc.scrollTop) / total) * 100
      for (const [limite, nome] of marcos) if (pct >= limite) enviar(nome)
    }
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // CTA: qualquer caminho que leve ao checkout ou ao cadastro. É o degrau que
  // separa quem leu de quem decidiu.
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const alvo = (e.target as HTMLElement | null)?.closest('a,button')
      if (!alvo) return
      const href = alvo.getAttribute('href') || ''
      const ehCta =
        href.includes('/checkout') ||
        href.includes('/register') ||
        href.includes('#planos') ||
        alvo.hasAttribute('data-cta')
      if (ehCta) enviar('cta_click', { href: href || null, texto: (alvo.textContent || '').trim().slice(0, 80) })
    }
    document.addEventListener('click', aoClicar, true)
    return () => document.removeEventListener('click', aoClicar, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
