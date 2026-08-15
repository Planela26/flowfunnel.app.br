/**
 * Cache do contexto da Sara.AI.
 *
 * Extraído de `sara-context-service` para quebrar um ciclo de import: o serviço
 * de contexto precisa selecionar memórias pelo plano (`sara-memory`), enquanto
 * `sara-memory` precisa invalidar este cache ao gravar. Com os dois importando
 * este módulo — e não um ao outro — não há ciclo em runtime.
 *
 * O import do tipo `SaraContext` é `import type`: some na compilação, então não
 * recria a aresta que este arquivo existe para eliminar.
 */

import type { SaraContext } from './sara-context-service'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

interface CacheEntry {
  context: SaraContext
  expiresAt: number
}

const contextCache = new Map<string, CacheEntry>()

// A chave inclui o pathname (rotas dinâmicas tipo /suporte/<id> geram uma entrada
// por página visitada), então sem um teto o Map cresce indefinidamente no processo
// Node de longa duração (PM2). Cap simples: ao ultrapassar o limite, remove primeiro
// as entradas expiradas e, se ainda necessário, as mais antigas (ordem de inserção).
const MAX_CACHE_ENTRIES = 500

function evictIfNeeded(): void {
  if (contextCache.size < MAX_CACHE_ENTRIES) return
  const now = Date.now()
  for (const [k, v] of contextCache) {
    if (v.expiresAt <= now) contextCache.delete(k)
  }
  while (contextCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = contextCache.keys().next().value
    if (oldestKey === undefined) break
    contextCache.delete(oldestKey)
  }
}

/**
 * O plano faz parte da chave.
 *
 * Sem ele, uma conta que troca de plano continuava lendo o contexto do plano
 * anterior até a entrada expirar — com a cota de memória e as capacidades
 * antigas. Incluir o plano faz a troca gerar uma entrada nova na hora.
 */
function cacheKey(userId: string, pathname?: string, plan?: string): string {
  return `${userId}::${plan ?? '?'}::${pathname ?? ''}`
}

/** Contexto ainda válido para o usuário/plano/página, ou null. */
export function getCachedContext(userId: string, pathname?: string, plan?: string): SaraContext | null {
  const entry = contextCache.get(cacheKey(userId, pathname, plan))
  if (entry && entry.expiresAt > Date.now()) return entry.context
  return null
}

/** Guarda o contexto montado, respeitando o teto de entradas. */
export function setCachedContext(
  userId: string,
  pathname: string | undefined,
  context: SaraContext,
  plan?: string,
): void {
  evictIfNeeded()
  contextCache.set(cacheKey(userId, pathname, plan), { context, expiresAt: Date.now() + CACHE_TTL_MS })
}

/**
 * Invalida tudo do usuário.
 *
 * O prefixo é `${userId}::` e não `${userId}`: ids com prefixo comum fariam um
 * `startsWith` cru limpar o cache de outra conta.
 */
export function invalidateContext(userId: string): void {
  const prefix = `${userId}::`
  for (const key of contextCache.keys()) {
    if (key.startsWith(prefix)) contextCache.delete(key)
  }
}
