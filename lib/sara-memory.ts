/**
 * SaraMemoryService — memória de longo prazo da Sara.AI.
 *
 * A Sara pode registrar preferências, objetivos, observações e decisões
 * do usuário. Essa memória é consultada antes de cada resposta para
 * personalizar a interação.
 *
 * Tipos de memória:
 *  - preference: "Usuário prefere respostas curtas"
 *  - goal:       "Usuário quer atingir R$ 50k/mês até dezembro"
 *  - observation:"Usuário tem dificuldade com integração Meta Ads"
 *  - decision:   "Usuário decidiu pausar campanha X em 2026-07-28"
 */

import { prisma } from '@/lib/prisma'
import { SaraContextService } from './sara-context-service'

export type MemoryType = 'preference' | 'goal' | 'observation' | 'decision'

export interface Memory {
  id:        string
  type:      MemoryType
  content:   string
  context?:  string | null
  createdAt: Date
}

export const SaraMemoryService = {

  /** Salva uma nova memória. Invalida o cache do usuário. */
  async save(userId: string, type: MemoryType, content: string, context?: string): Promise<Memory> {
    const memory = await prisma.saraMemory.create({
      data: { userId, type, content, context },
    })
    SaraContextService.invalidate(userId)
    return memory as Memory
  },

  /** Retorna todas as memórias de um usuário, mais recentes primeiro. */
  async getAll(userId: string): Promise<Memory[]> {
    return prisma.saraMemory.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<Memory[]>
  },

  /**
   * Retorna memórias relevantes para um tópico específico.
   * Busca por substring simples (produção: substituir por embedding similarity).
   */
  async getRelevant(userId: string, topic: string): Promise<Memory[]> {
    const topicLower = topic.toLowerCase().slice(0, 30)
    return prisma.saraMemory.findMany({
      where: {
        userId,
        content: { contains: topicLower, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }) as Promise<Memory[]>
  },

  /** Remove uma memória específica. */
  async delete(userId: string, memoryId: string): Promise<void> {
    await prisma.saraMemory.deleteMany({
      where: { id: memoryId, userId },
    })
    SaraContextService.invalidate(userId)
  },

  /** Remove todas as memórias de um usuário (usado ao deletar conta). */
  async deleteAll(userId: string): Promise<void> {
    await prisma.saraMemory.deleteMany({ where: { userId } })
    SaraContextService.invalidate(userId)
  },

  /**
   * Extrai memórias relevantes de uma mensagem de usuário usando heurísticas simples.
   * Produção: usar NLP para extração automática de entidades e intenções.
   */
  extractIntentions(message: string): { type: MemoryType; content: string } | null {
    const lower = message.toLowerCase()

    if (lower.includes('quero') || lower.includes('meu objetivo') || lower.includes('meta')) {
      return { type: 'goal', content: message.slice(0, 200) }
    }
    if (lower.includes('prefiro') || lower.includes('gosto de') || lower.includes('não gosto')) {
      return { type: 'preference', content: message.slice(0, 200) }
    }
    if (lower.includes('decidi') || lower.includes('vou') && lower.includes('pausar')) {
      return { type: 'decision', content: message.slice(0, 200) }
    }

    return null
  },
}
