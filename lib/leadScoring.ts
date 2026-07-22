/**
 * Sistema de qualificação de leads baseado em regras (sem IA real).
 * Gera score de 0–100 e classificação quente/morno/frio.
 *
 * Sinais considerados:
 *  - Eventos do lead (cliques, conversas, checkouts, vendas)
 *  - Origem do tráfego (META_ADS, HOTMART, KIWIFY, etc)
 *  - Recência da última interação
 *  - Quantidade de interações
 *  - Tempo entre primeira e última interação (engajamento)
 */

export type LeadClass = 'quente' | 'morno' | 'frio'

export type LeadInput = {
  phone?: string | null
  email?: string | null
  name?: string | null
  platform?: string | null
  events: Array<{
    type: string             // 'click' | 'message' | 'checkout' | 'sale' | etc
    platform?: string | null
    timestamp: Date | string
    amount?: number | null
  }>
}

export type LeadScored = {
  identifier: string
  name: string
  phone: string
  email: string
  origin: string
  score: number
  classification: LeadClass
  signals: string[]          // razões legíveis
  totalEvents: number
  lastInteraction: string    // ISO
  totalSpent: number
}

const NOW = () => Date.now()

function eventWeight(type: string): number {
  switch (type.toLowerCase()) {
    case 'sale':
    case 'pagamento_confirmado':
    case 'payment_confirmed':
      return 40
    case 'checkout':
    case 'checkout_iniciado':
      return 18
    case 'message':
    case 'conversa':
      return 8
    case 'click':
    case 'clique':
      return 3
    case 'lead':
    case 'qualified':
      return 12
    default:
      return 2
  }
}

function originBonus(origin: string): number {
  const o = origin.toUpperCase()
  if (o === 'HOTMART' || o === 'KIWIFY' || o === 'EDUZZ' || o === 'MONETIZZE') return 6
  if (o === 'WHATSAPP') return 4
  if (o === 'META_ADS' || o === 'FACEBOOK') return 2
  return 0
}

export function scoreLead(input: LeadInput): LeadScored {
  const events = input.events || []
  const signals: string[] = []

  let score = 0
  let totalSpent = 0

  // Pontos por evento
  let weightedSum = 0
  for (const e of events) {
    const w = eventWeight(e.type)
    weightedSum += w
    if (typeof e.amount === 'number' && e.amount > 0) {
      totalSpent += e.amount
    }
  }
  score += Math.min(60, weightedSum) // teto de 60 pts em eventos

  if (events.length >= 3) {
    score += 8
    signals.push('Múltiplas interações')
  }
  if (events.some(e => ['sale', 'pagamento_confirmado', 'payment_confirmed'].includes(e.type.toLowerCase()))) {
    score += 15
    signals.push('Já comprou')
  }
  if (events.some(e => ['checkout', 'checkout_iniciado'].includes(e.type.toLowerCase()))) {
    score += 6
    signals.push('Iniciou checkout')
  }
  if (events.some(e => ['message', 'conversa'].includes(e.type.toLowerCase()))) {
    signals.push('Engajou no WhatsApp')
  }

  // Bônus por origem
  const originSrc = (events[0]?.platform || input.platform || '').toString()
  score += originBonus(originSrc)

  // Recência: leads recentes pontuam mais
  const last = events[events.length - 1]
  if (last) {
    const ts = new Date(last.timestamp).getTime()
    const hoursAgo = (NOW() - ts) / (1000 * 60 * 60)
    if (hoursAgo < 24) {
      score += 10
      signals.push('Ativo nas últimas 24h')
    } else if (hoursAgo < 72) {
      score += 5
      signals.push('Ativo nos últimos 3 dias')
    } else if (hoursAgo > 30 * 24) {
      score -= 10
      signals.push('Sem interação há mais de 30 dias')
    }
  }

  // Engajamento ao longo do tempo
  if (events.length >= 2) {
    const first = new Date(events[0].timestamp).getTime()
    const lastT = new Date(events[events.length - 1].timestamp).getTime()
    const dias = Math.max(1, (lastT - first) / (1000 * 60 * 60 * 24))
    if (events.length / dias >= 1) {
      score += 5
      signals.push('Alta frequência de interações')
    }
  }

  // Clamp 0..100
  score = Math.max(0, Math.min(100, Math.round(score)))

  let classification: LeadClass = 'frio'
  if (score >= 71) classification = 'quente'
  else if (score >= 31) classification = 'morno'

  return {
    identifier: (input.phone || input.email || input.name || 'lead-' + Math.random().toString(36).slice(2, 8)).toString(),
    name: input.name || 'Sem nome',
    phone: input.phone || '',
    email: input.email || '',
    origin: originSrc || 'Desconhecido',
    score,
    classification,
    signals,
    totalEvents: events.length,
    lastInteraction: last ? new Date(last.timestamp).toISOString() : new Date().toISOString(),
    totalSpent,
  }
}
