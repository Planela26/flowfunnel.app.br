/**
 * Capacidades da Sara.AI por plano — ponto ÚNICO de decisão.
 *
 * Antes disto, a única diferença real entre START e SCALE era a cota diária de
 * `AI_DAILY_QUOTA`: o modelo, o contexto, a memória e a profundidade eram
 * idênticos. Na prática o SCALE era "o START com mais mensagens", enquanto a
 * vitrine vendia "IA avançada" — a diferença de preço não existia no produto.
 *
 * Nenhuma rota deve escrever `if (plan === 'SCALE')`. Toda decisão sobre o que
 * a Sara pode fazer passa por `getSaraCapabilities()`, do mesmo jeito que toda
 * decisão de feature passa por `canAccessFeature()` em `lib/plans.ts`.
 */

import { normalizePlan, getHistoryLimitDays, type Plan } from './plans'

/** Nome comercial da Sara exibido ao usuário, por plano. */
export type SaraVersion = 'SARA.AI' | 'SARA.AI+ 2.0'

export interface SaraCapabilities {
  /** Marca exibida na interface. */
  version: SaraVersion
  /** Sufixo comercial do SCALE. Vazio nos demais. */
  versionSuffix: string
  /** Rótulo completo para UI: "SARA.AI+ 2.0 — Inteligência Estratégica". */
  label: string

  // ── Memória ───────────────────────────────────────────────────────────────
  /** Memória persistente entre conversas. */
  memory: boolean
  /** Quantas memórias entram no contexto de cada resposta. */
  maxMemories: number
  /** Retenção em dias. -1 = sem expiração (histórico estratégico). */
  memoryRetentionDays: number
  /** Memória estratégica: padrões, aprendizados, acompanhamento de objetivos. */
  strategicMemory: boolean

  // ── Análise ───────────────────────────────────────────────────────────────
  /** Janela de dados que a Sara enxerga, em dias. Espelha o histórico do plano. */
  analysisWindowDays: number
  /** Diagnóstico completo em vez de resposta superficial. */
  advancedDiagnostics: boolean
  /** Insights avançados com cruzamento de métricas. */
  advancedInsights: boolean
  /** Análise de campanhas. */
  campaignAnalysis: boolean
  /** Consome comparação período-a-período estruturada. */
  historicalComparison: boolean

  // ── Estratégico (SCALE) ───────────────────────────────────────────────────
  /** Interpreta tendências ao longo do tempo, não só o número do período. */
  trendInterpretation: boolean
  /** Aponta anomalias nos dados comparados. */
  anomalyDetection: boolean
  /** Emite recomendações estratégicas acionáveis. */
  strategicRecommendations: boolean
  /** Acompanha objetivos declarados ao longo do tempo. */
  goalTracking: boolean

  /** Quantas sugestões `/api/ai/suggestions` produz por análise. */
  suggestionCount: number

  // ── Execução ──────────────────────────────────────────────────────────────
  /**
   * Modelo usado. Hoje idêntico em todos os planos de propósito: a
   * diferenciação desta entrega é capacidade, não custo por token. O campo
   * existe para que trocar o modelo de um plano no futuro seja uma linha aqui,
   * e não uma caçada por strings espalhadas pelas rotas.
   */
  model: string
  /** Teto de mensagens do histórico enviadas ao modelo. */
  maxContextMessages: number
}

/**
 * Modelo atual, unificado.
 *
 * Estava escrito à mão em `lib/sara-ai-service.ts` e em `app/api/ai/chat`.
 * Centralizar aqui evita que os dois divirjam silenciosamente.
 */
export const SARA_DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * Quantas memórias entram no contexto.
 *
 * O valor de hoje é 10 para todos (`sara-context-service`). Manter 10 no PRO
 * preserva exatamente o comportamento atual de quem já paga; o START cai para 3
 * e o SCALE sobe para 25. Com ~200 caracteres por memória, 25 ocupa ~5k dos
 * 24k de `AI_LIMITS.maxCharsTotal` — folga suficiente para o restante do prompt.
 */
const MEMORY_SLOTS: Record<Plan, number> = {
  FREE: 0,
  START: 3,
  PRO: 10,
  SCALE: 25,
}

/**
 * Retenção da memória em dias. -1 = sem expiração.
 *
 * PRO espelha `PLAN_HISTORY_DAYS` (365). O SCALE não expira porque o produto
 * dele é justamente o histórico estratégico de longo prazo — memória com prazo
 * de validade destruiria a comparação que o plano vende.
 */
const MEMORY_RETENTION: Record<Plan, number> = {
  FREE: 0,
  START: 30,
  PRO: 365,
  SCALE: -1,
}

const CAPABILITIES: Record<Plan, SaraCapabilities> = {
  FREE: {
    version: 'SARA.AI',
    versionSuffix: '',
    label: 'SARA.AI',
    memory: false,
    maxMemories: MEMORY_SLOTS.FREE,
    memoryRetentionDays: MEMORY_RETENTION.FREE,
    strategicMemory: false,
    analysisWindowDays: getHistoryLimitDays('FREE'),
    advancedDiagnostics: false,
    advancedInsights: false,
    campaignAnalysis: false,
    historicalComparison: false,
    trendInterpretation: false,
    anomalyDetection: false,
    strategicRecommendations: false,
    goalTracking: false,
    model: SARA_DEFAULT_MODEL,
    suggestionCount: 3,
    maxContextMessages: 10,
  },

  // Assistente funcional e útil — o corte é de profundidade, não de utilidade.
  // Responde, explica métricas e dá insights simples com memória curta.
  START: {
    version: 'SARA.AI',
    versionSuffix: '',
    label: 'SARA.AI',
    memory: true,
    maxMemories: MEMORY_SLOTS.START,
    memoryRetentionDays: MEMORY_RETENTION.START,
    strategicMemory: false,
    analysisWindowDays: getHistoryLimitDays('START'),
    advancedDiagnostics: false,
    advancedInsights: false,
    campaignAnalysis: false,
    historicalComparison: false,
    trendInterpretation: false,
    anomalyDetection: false,
    strategicRecommendations: false,
    goalTracking: false,
    model: SARA_DEFAULT_MODEL,
    suggestionCount: 3,
    maxContextMessages: 15,
  },

  PRO: {
    version: 'SARA.AI+ 2.0',
    versionSuffix: '',
    label: 'SARA.AI+ 2.0',
    memory: true,
    maxMemories: MEMORY_SLOTS.PRO,
    memoryRetentionDays: MEMORY_RETENTION.PRO,
    strategicMemory: false,
    analysisWindowDays: getHistoryLimitDays('PRO'),
    advancedDiagnostics: true,
    advancedInsights: true,
    campaignAnalysis: true,
    historicalComparison: true,
    trendInterpretation: false,
    anomalyDetection: false,
    strategicRecommendations: false,
    goalTracking: false,
    model: SARA_DEFAULT_MODEL,
    suggestionCount: 4,
    maxContextMessages: 25,
  },

  // Mesma marca do PRO com camada estratégica: o diferencial é interpretar a
  // evolução histórica, não responder mais vezes.
  SCALE: {
    version: 'SARA.AI+ 2.0',
    versionSuffix: 'Inteligência Estratégica',
    label: 'SARA.AI+ 2.0 — Inteligência Estratégica',
    memory: true,
    maxMemories: MEMORY_SLOTS.SCALE,
    memoryRetentionDays: MEMORY_RETENTION.SCALE,
    strategicMemory: true,
    analysisWindowDays: getHistoryLimitDays('SCALE'),
    advancedDiagnostics: true,
    advancedInsights: true,
    campaignAnalysis: true,
    historicalComparison: true,
    trendInterpretation: true,
    anomalyDetection: true,
    strategicRecommendations: true,
    goalTracking: true,
    model: SARA_DEFAULT_MODEL,
    suggestionCount: 5,
    maxContextMessages: 30,
  },
}

/** Capacidades da Sara para o plano efetivo do usuário. */
export function getSaraCapabilities(plan: string | null | undefined): SaraCapabilities {
  return CAPABILITIES[normalizePlan(plan)]
}

/** Chaves booleanas de capacidade — as que fazem sentido gatear numa rota. */
export type SaraCapability = {
  [K in keyof SaraCapabilities]: SaraCapabilities[K] extends boolean ? K : never
}[keyof SaraCapabilities]

/** O plano permite esta capacidade? Equivalente a `canAccessFeature` para a Sara. */
export function hasSaraCapability(
  plan: string | null | undefined,
  capability: SaraCapability,
): boolean {
  return getSaraCapabilities(plan)[capability]
}

/** Menor plano que oferece a capacidade — usado nas mensagens de upgrade. */
export function minPlanForCapability(capability: SaraCapability): Plan {
  const order: Plan[] = ['FREE', 'START', 'PRO', 'SCALE']
  return order.find(p => CAPABILITIES[p][capability]) ?? 'SCALE'
}

/**
 * Mensagem comercial de upgrade. A UI nunca deve mostrar erro técnico quando o
 * bloqueio é de plano — o usuário não errou, ele só não contratou aquilo ainda.
 */
export function upgradeMessageFor(capability: SaraCapability): string {
  const min = minPlanForCapability(capability)
  if (min === 'SCALE') {
    return 'Este recurso faz parte da inteligência estratégica da SARA.AI+ 2.0. Disponível no plano SCALE.'
  }
  return 'Este recurso faz parte da SARA.AI+ 2.0. Faça upgrade para o plano PRO para desbloquear análises avançadas.'
}
