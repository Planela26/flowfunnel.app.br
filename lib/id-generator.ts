/**
 * IdGeneratorService — serviço centralizado de geração de IDs públicos do FlowSara.
 *
 * FORMATO: PREFIX-XXXXXX
 *   - Prefixo: 3 letras que identificam o domínio (FLS, USR, SUP, WKS, ORG, INV)
 *   - Separador: hífen
 *   - Código: N caracteres aleatórios do charset sem ambiguidade
 *
 * CHARSET (sem: O, 0, I, 1, L — evita confusão visual):
 *   ABCDEFGHJKLMNPQRSTUVWXYZ23456789
 *
 * UNICIDADE: verifica no banco (SELECT) antes de retornar — reduz a chance de
 * colisão, mas não a elimina: entre o SELECT aqui e o INSERT/UPDATE do chamador
 * ainda existe uma janela de corrida. `generate()` NÃO captura erro de unique
 * constraint (P2002) — cada chamador que persiste o ID retornado é responsável
 * por tratar esse erro e tentar novamente (ver `app/api/account/public-id/route.ts`
 * para o padrão de retry esperado). Isso vale para todos os métodos abaixo
 * (`generateTicketId`, `generateWorkspaceId`, `generateInviteId`, etc.) — nenhum
 * deles tem proteção automática contra colisão além da checagem prévia.
 *
 * Para trocar o comprimento do código: altere DEFAULT_LENGTH sem refatoração.
 */

import { prisma } from '@/lib/prisma'

// ── Config ────────────────────────────────────────────────────────────────────

/** Charset sem caracteres ambíguos conforme especificação. */
export const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' as const

/** Comprimento padrão da parte aleatória. Altere aqui para 8, 10 ou 12. */
const DEFAULT_LENGTH = 6

/** Máximo de tentativas antes de lançar erro (prevenção de loop infinito). */
const MAX_ATTEMPTS = 20

// ── Prefixes ──────────────────────────────────────────────────────────────────

export const PREFIX = {
  ACCOUNT:      'FLS',
  USER:         'USR',
  TICKET:       'SUP',
  WORKSPACE:    'WKS',
  ORGANIZATION: 'ORG',
  INVITE:       'INV',
} as const

export type PublicIdPrefix = typeof PREFIX[keyof typeof PREFIX]

// ── Format helpers ────────────────────────────────────────────────────────────

/** Gera uma string aleatória de `length` caracteres do CHARSET. */
function randomCode(length: number = DEFAULT_LENGTH): string {
  const chars = CHARSET
  let code = ''
  // crypto.getRandomValues se disponível (Node 19+/Edge), senão Math.random
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      code += chars[byte % chars.length]
    }
  } else {
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return code
}

/** Monta o ID público completo: "PREFIX-XXXXXX". */
export function buildPublicId(prefix: PublicIdPrefix, code: string): string {
  return `${prefix}-${code}`
}

/** Valida se uma string segue o formato esperado de ID público. */
export function isValidPublicId(id: string): boolean {
  return /^[A-Z]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4,12}$/.test(id)
}

/** Extrai o prefixo de um ID público (ex: "FLS-2A9KX8" → "FLS"). */
export function extractPrefix(id: string): string {
  return id.split('-')[0] ?? ''
}

// ── Existence checkers (consulta apenas o campo público, sem carregar registros inteiros) ──

type ExistsChecker = (id: string) => Promise<boolean>

const checkers: Record<PublicIdPrefix, ExistsChecker> = {
  [PREFIX.ACCOUNT]: async (id) => {
    const r = await prisma.user.findUnique({ where: { publicId: id }, select: { id: true } })
    return r !== null
  },
  [PREFIX.USER]: async (id) => {
    const r = await prisma.user.findUnique({ where: { publicId: id }, select: { id: true } })
    return r !== null
  },
  [PREFIX.TICKET]: async (id) => {
    const r = await prisma.supportTicket.findUnique({ where: { publicId: id }, select: { id: true } })
    return r !== null
  },
  [PREFIX.WORKSPACE]: async (id) => {
    const r = await prisma.workspace.findUnique({ where: { publicId: id }, select: { id: true } })
    return r !== null
  },
  [PREFIX.ORGANIZATION]: async (id) => {
    // Reservado para uso futuro — sem tabela ainda
    return false
  },
  [PREFIX.INVITE]: async (id) => {
    const r = await prisma.teamMember.findUnique({ where: { publicId: id }, select: { id: true } })
    return r !== null
  },
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Gera um ID público único para o prefixo dado.
 * Verifica disponibilidade no banco antes de retornar.
 * Aceita `length` opcional para gerar IDs com mais caracteres no futuro.
 */
async function generate(prefix: PublicIdPrefix, length: number = DEFAULT_LENGTH): Promise<string> {
  const check = checkers[prefix]
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const code = randomCode(length)
    const id   = buildPublicId(prefix, code)
    const exists = await check(id)
    if (!exists) return id
  }
  throw new Error(
    `[IdGeneratorService] Não foi possível gerar um ID único para o prefixo "${prefix}" em ${MAX_ATTEMPTS} tentativas.`
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

export const IdGeneratorService = {
  /**
   * ID público do usuário FlowSara — exibido como "ID FlowSara" na interface.
   * Formato: FLS-XXXXXX
   */
  generateAccountId(length?: number): Promise<string> {
    return generate(PREFIX.ACCOUNT, length)
  },

  /**
   * ID de usuário (para uso em contextos multi-tenant futuros).
   * Formato: USR-XXXXXX
   */
  generateUserId(length?: number): Promise<string> {
    return generate(PREFIX.USER, length)
  },

  /**
   * ID público de ticket de suporte.
   * Formato: SUP-XXXXXX
   */
  generateTicketId(length?: number): Promise<string> {
    return generate(PREFIX.TICKET, length)
  },

  /**
   * ID público de workspace.
   * Formato: WKS-XXXXXX
   */
  generateWorkspaceId(length?: number): Promise<string> {
    return generate(PREFIX.WORKSPACE, length)
  },

  /**
   * ID de organização (reservado para uso futuro).
   * Formato: ORG-XXXXXX
   */
  generateOrganizationId(length?: number): Promise<string> {
    return generate(PREFIX.ORGANIZATION, length)
  },

  /**
   * ID de convite de time.
   * Formato: INV-XXXXXX
   */
  generateInviteId(length?: number): Promise<string> {
    return generate(PREFIX.INVITE, length)
  },

  // ── Utilidades ──────────────────────────────────────────────────────────────

  /** Gera código aleatório (exposto para testes). */
  _randomCode: randomCode,

  /** Verifica se um ID público tem formato válido. */
  isValid: isValidPublicId,

  /** Extrai o prefixo de um ID público. */
  extractPrefix,

  /** Charset em uso. */
  CHARSET,

  /** Prefixos disponíveis. */
  PREFIX,
} as const
