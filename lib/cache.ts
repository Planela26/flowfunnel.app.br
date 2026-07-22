// Sistema de cache em memória para métricas
interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

class CacheManager {
  private cache: Map<string, CacheEntry>
  private cleanupInterval: NodeJS.Timeout | null

  constructor() {
    this.cache = new Map()
    this.cleanupInterval = null
    this.startCleanup()
  }

  // Iniciar limpeza automática a cada 5 minutos
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000) // 5 minutos
  }

  // Limpar entradas expiradas
  private cleanup() {
    const now = Date.now()
    const keysToDelete: string[] = []

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
    
    if (keysToDelete.length > 0) {
      console.log(`[Cache] Limpeza: ${keysToDelete.length} entradas removidas`)
    }
  }

  // Obter item do cache
  get(key: string): any | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Verificar se expirou
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    console.log(`[Cache] Hit: ${key}`)
    return entry.data
  }

  // Salvar item no cache
  set(key: string, data: any, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
    console.log(`[Cache] Set: ${key} (TTL: ${ttl}ms)`)
  }

  // Remover item do cache
  delete(key: string): void {
    this.cache.delete(key)
    console.log(`[Cache] Delete: ${key}`)
  }

  // Limpar todo o cache
  clear(): void {
    this.cache.clear()
    console.log('[Cache] Todos os dados limpos')
  }

  // Invalidar cache por padrão (regex)
  invalidatePattern(pattern: RegExp): void {
    const keysToDelete: string[] = []
    
    this.cache.forEach((_, key) => {
      if (pattern.test(key)) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
    console.log(`[Cache] Invalidado padrão ${pattern}: ${keysToDelete.length} entradas`)
  }

  // Obter estatísticas do cache
  getStats() {
    return {
      entries: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  // Parar limpeza automática
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Instância global do cache
export const cache = new CacheManager()

// Helper para gerar chave de cache
export function generateCacheKey(userId: string, endpoint: string, params?: any): string {
  const paramString = params ? JSON.stringify(params) : ''
  return `${userId}:${endpoint}:${paramString}`
}

// TTL padrões (em milissegundos)
export const CacheTTL = {
  SHORT: 30 * 1000,        // 30 segundos
  MEDIUM: 2 * 60 * 1000,   // 2 minutos
  LONG: 5 * 60 * 1000,     // 5 minutos
  VERY_LONG: 15 * 60 * 1000, // 15 minutos
}
