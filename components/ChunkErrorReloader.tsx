'use client'

import { useEffect } from 'react'

const KEY = 'flowfunnel:chunk-reload-at'
const COOLDOWN_MS = 10_000

function isChunkError(err: unknown): boolean {
  if (!err) return false
  const msg =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.reason?.message || ''
  const name =
    (err as any)?.name || (err as any)?.reason?.name || ''
  if (!msg && !name) return false
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to load chunk/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  )
}

function maybeReload() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || '0')
    if (Date.now() - last < COOLDOWN_MS) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {}
  window.location.reload()
}

export default function ChunkErrorReloader() {
  useEffect(() => {
    // 1) Erros JS clássicos: window.onerror / unhandledrejection.
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error) || isChunkError(e.message)) maybeReload()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) maybeReload()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    // 2) Captura erros de <script>/<link> via captura no window (evento "error"
    // borbulha em resources de script/css). Quando o chunk fetch falha, o
    // navegador dispara este evento COM o elemento alvo —我们 recarregamos para
    // pegar a versão nova do build.
    const onResourceError = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName?.toLowerCase?.()
      if (tag !== 'script' && tag !== 'link' && tag !== 'img') return
      const src =
        (target as HTMLScriptElement).src ||
        (target as HTMLLinkElement).href ||
        (target as HTMLImageElement).src ||
        ''
      if (!src) return
      // Match chunks do Next/Turbopack: qualquer caminho com "_next/static" e
      // extensão .js/.css, OU chunk numérico estilo Turbopack.
      if (/_next\/static\/.+\.(js|css|mjs)(\?|$)/.test(src)) maybeReload()
    }
    window.addEventListener('error', onResourceError, true)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('error', onResourceError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
