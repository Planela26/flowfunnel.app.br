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
 *
 * A capacidade de memória é do PLANO e é decidida no backend, em
 * `lib/sara-capabilities.ts`. O frontend nunca é a proteção: quem chamar
 * `/api/sara/memory` direto passa exatamente pelas mesmas regras daqui.
 */

import { prisma } from '@/lib/prisma'
// Cache direto, e não `SaraContextService`: o serviço de contexto agora importa
// este arquivo para selecionar memórias por plano, e importar de volta o serviço
// fecharia um ciclo em runtime.
import { invalidateContext } from './sara-context-cache'
import { getSaraCapabilities } from './sara-capabilities'

export type MemoryType = 'preference' | 'goal' | 'observation' | 'decision'
export type MemoryImportance = 'low' | 'normal' | 'high'
export type MemorySource = 'user' | 'auto' | 'system'

export interface Memory {
  id:         string
  type:       MemoryType
  content:    string
  context?:   string | null
  importance: MemoryImportance
  source:     MemorySource
  keywords?:  string | null
  metadata?:  string | null
  expiresAt?: Date | null
  createdAt:  Date
}

/**
 * Tipos que só existem para quem tem memória estratégica (SCALE).
 *
 * `decision` é o registro de escolhas do negócio ao longo do tempo — é o
 * insumo do acompanhamento estratégico, não uma preferência de interface.
 */
const STRATEGIC_TYPES: ReadonlySet<MemoryType> = new Set<MemoryType>(['decision'])

/** Peso para ordenar a seleção quando a cota do plano é menor que o acervo. */
const IMPORTANCE_WEIGHT: Record<MemoryImportance, number> = {
  high: 3,
  normal: 2,
  low: 1,
}

/**
 * Palavras-chave do conteúdo, para busca por relevância.
 *
 * Passo intermediário deliberado até embeddings: guardar os termos
 * significativos permite casar "objetivo do WhatsApp" com uma memória escrita
 * como "aumentar a conversão do WhatsApp", coisa que o `contains` sobre os 30
 * primeiros caracteres do tópico não fazia.
 */
export function extractKeywords(text: string): string {
  const STOP = new Set([
    'para','com','que','uma','uns','umas','dos','das','por','pelo','pela','nos','nas',
    'meu','minha','meus','minhas','este','esta','isso','aquilo','como','mais','menos',
    'quero','preciso','vou','tenho','fazer','sobre','entre','muito','todo','toda','ate',
    'the','and','for','with',
  ])
  const seen = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-zà-ú0-9]+/i)) {
    // Acentos fora: "conversao" e "conversão" precisam casar entre si.
    const w = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (w.length < 4 || STOP.has(w)) continue
    seen.add(w)
    if (seen.size >= 12) break
  }
  return [...seen].join(' ')
}

/** Data de expiração conforme a retenção do plano. -1 = não expira. */
function expiryFor(plan: string | null | undefined): Date | null {
  const { memoryRetentionDays } = getSaraCapabilities(plan)
  if (memoryRetentionDays < 0) return null
  return new Date(Date.now() + memoryRetentionDays * 24 * 60 * 60 * 1000)
}

export const SaraMemoryService = {

  /**
   * Salva uma nova memória, respeitando as capacidades do plano.
   *
   * Retorna `null` quando o plano não tem memória — silencioso de propósito
   * nos fluxos automáticos (o chat chama isto em fire-and-forget e não deve
   * quebrar por causa disso). As rotas que atendem uma ação explícita do
   * usuário verificam a capacidade antes e devolvem 402.
   */
  async save(
    userId: string,
    type: MemoryType,
    content: string,
    context?: string,
    opts?: { plan?: string | null; importance?: MemoryImportance; source?: MemorySource; metadata?: string },
  ): Promise<Memory | null> {
    const plan = opts?.plan ?? (await this._planOf(userId))
    const caps = getSaraCapabilities(plan)
    if (!caps.memory) return null

    // Memória estratégica é do SCALE. Sem esta linha, um START poderia gravar
    // `decision` chamando a API direto e o tipo perderia o sentido comercial.
    if (STRATEGIC_TYPES.has(type) && !caps.strategicMemory) return null

    const memory = await prisma.saraMemory.create({
      data: {
        userId,
        type,
        content,
        context,
        importance: opts?.importance ?? 'normal',
        source: opts?.source ?? 'auto',
        keywords: extractKeywords(content),
        metadata: opts?.metadata,
        expiresAt: expiryFor(plan),
      },
    })
    invalidateContext(userId)
    return memory as Memory
  },

  /** Retorna as memórias vivas de um usuário, mais recentes primeiro. */
  async getAll(userId: string): Promise<Memory[]> {
    return prisma.saraMemory.findMany({
      where:   { userId, ...notExpired() },
      orderBy: { createdAt: 'desc' },
    }) as Promise<Memory[]>
  },

  /**
   * Memórias que entram no contexto de uma resposta, dentro da cota do plano.
   *
   * Ordenar só por data fazia uma observação trivial de ontem expulsar o
   * objetivo declarado do negócio — o que fica pior quanto menor a cota, e a
   * cota do START é 3. Por isso a seleção é por importância e depois por data.
   */
  async getForContext(userId: string, plan: string | null | undefined): Promise<Memory[]> {
    const caps = getSaraCapabilities(plan)
    if (!caps.memory || caps.maxMemories <= 0) return []

    const rows = await prisma.saraMemory.findMany({
      where: {
        userId,
        ...notExpired(),
        // Sem memória estratégica, `decision` nem chega ao prompt.
        ...(caps.strategicMemory ? {} : { type: { notIn: [...STRATEGIC_TYPES] } }),
      },
      orderBy: { createdAt: 'desc' },
      // Teto de leitura: ordenar por importância exige mais linhas do que a
      // cota, mas sem isto uma conta antiga carregaria o acervo inteiro.
      take: Math.max(caps.maxMemories * 4, 20),
    })

    return (rows as Memory[])
      .sort((a, b) => {
        const w = IMPORTANCE_WEIGHT[b.importance] - IMPORTANCE_WEIGHT[a.importance]
        return w !== 0 ? w : b.createdAt.getTime() - a.createdAt.getTime()
      })
      .slice(0, caps.maxMemories)
  },

  /**
   * Memórias relevantes para um tópico.
   *
   * Antes: `contains` com os 30 primeiros caracteres do tópico — só acertava
   * quando a pergunta repetia as palavras exatas da memória. Agora casa termo a
   * termo contra `keywords` e contra o conteúdo, e pontua por sobreposição.
   */
  async getRelevant(userId: string, topic: string, plan?: string | null): Promise<Memory[]> {
    const caps = getSaraCapabilities(plan ?? (await this._planOf(userId)))
    if (!caps.memory) return []

    const terms = extractKeywords(topic).split(' ').filter(Boolean).slice(0, 6)
    if (terms.length === 0) return []

    const rows = await prisma.saraMemory.findMany({
      where: {
        userId,
        ...(caps.strategicMemory ? {} : { type: { notIn: [...STRATEGIC_TYPES] } }),
        // AND explícito: `notExpired()` também devolve um `OR`, e espalhar os
        // dois no mesmo objeto faria a chave de termos sobrescrever a de
        // expiração — memória vencida voltaria a aparecer, sem erro nenhum.
        AND: [
          notExpired(),
          {
            OR: terms.flatMap(t => ([
              { keywords: { contains: t, mode: 'insensitive' as const } },
              { content:  { contains: t, mode: 'insensitive' as const } },
            ])),
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(caps.maxMemories * 4, 20),
    })

    const score = (m: Memory) => {
      const hay = `${m.keywords ?? ''} ${m.content}`.toLowerCase()
      const hits = terms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0)
      return hits * 10 + IMPORTANCE_WEIGHT[m.importance]
    }

    return (rows as Memory[])
      .sort((a, b) => score(b) - score(a) || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, caps.maxMemories)
  },

  /** Remove uma memória específica. */
  async delete(userId: string, memoryId: string): Promise<void> {
    await prisma.saraMemory.deleteMany({
      where: { id: memoryId, userId },
    })
    invalidateContext(userId)
  },

  /** Remove todas as memórias de um usuário (usado ao deletar conta). */
  async deleteAll(userId: string): Promise<void> {
    await prisma.saraMemory.deleteMany({ where: { userId } })
    invalidateContext(userId)
  },

  /**
   * Extrai memórias relevantes de uma mensagem de usuário usando heurísticas simples.
   * Produção: usar NLP para extração automática de entidades e intenções.
   */
  extractIntentions(message: string): { type: MemoryType; content: string; importance: MemoryImportance } | null {
    const lower = message.toLowerCase()

    // Objetivo declarado é o que mais importa quando a cota é pequena.
    if (lower.includes('quero') || lower.includes('meu objetivo') || lower.includes('meta')) {
      return { type: 'goal', content: message.slice(0, 200), importance: 'high' }
    }
    if (lower.includes('prefiro') || lower.includes('gosto de') || lower.includes('não gosto')) {
      return { type: 'preference', content: message.slice(0, 200), importance: 'normal' }
    }
    // Parênteses explícitos: antes era `decidi || vou && pausar`, e a
    // precedência de && sobre || deixava a intenção ambígua para quem lia.
    if (lower.includes('decidi') || (lower.includes('vou') && lower.includes('pausar'))) {
      return { type: 'decision', content: message.slice(0, 200), importance: 'high' }
    }

    return null
  },

  /** Plano efetivo do usuário. Interno — as rotas já têm o plano em mãos. */
  async _planOf(userId: string): Promise<string> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialEndsAt: true, trialPlan: true, trialStatus: true },
    }).catch(() => null)
    if (!u) return 'FREE'
    const { getEffectivePlan } = await import('./trial')
    return getEffectivePlan(u)
  },
}

/** Descarta memórias vencidas sem depender de job de limpeza. */
function notExpired() {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
}
