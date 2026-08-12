// Atribuição segura de afiliados — Fase 3 (AFFILIATE_WALLET_ARCHITECTURE.md §18/§24.4).
//
// Substitui dois pontos de confiança indevida no cliente:
//   1. localStorage.affiliate_code (editável via DevTools) -> cookie httpOnly
//      assinado (HMAC-SHA256), verificado em toda leitura, fail-closed.
//   2. affiliateId vindo do corpo da requisição de checkout -> resolução
//      server-side (ver resolveCheckoutAffiliateId).
//
// Formato do cookie, exatamente como especificado no §24.4:
//   base64(JSON{ affiliateId, issuedAt, expiresAt }) + "." + HMAC-SHA256(payload, secret)
//
// Segredo: reaproveita NEXTAUTH_SECRET (evita nova variável de ambiente em
// produção) com domain separation — o HMAC é calculado sobre "ff_attr:" +
// payload, nunca sobre o payload sozinho, para não reutilizar o mesmo
// contexto criptográfico de sessão do NextAuth.
import crypto from 'crypto'
import { NextResponse } from 'next/server'

export const ATTRIBUTION_COOKIE_NAME = 'ff_attr'
const ATTRIBUTION_WINDOW_DAYS = 30 // Decisão A do desenho
export const ATTRIBUTION_MAX_AGE_SECONDS = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60

type AttributionPayload = {
  affiliateId: string
  issuedAt: number
  expiresAt: number
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('affiliate-attribution: NEXTAUTH_SECRET/SESSION_SECRET não configurado')
  }
  return secret
}

function hmac(encodedPayload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(`ff_attr:${encodedPayload}`).digest('hex')
}

/** Gera o VALOR do cookie (sem os atributos Set-Cookie) para um afiliado. */
export function signAttributionCookie(affiliateId: string): string {
  const now = Date.now()
  const payload: AttributionPayload = {
    affiliateId,
    issuedAt: now,
    expiresAt: now + ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  return `${encoded}.${hmac(encoded)}`
}

/**
 * Verifica um valor de cookie ff_attr. Fail-closed: qualquer coisa fora do
 * esperado (ausente, malformado, assinatura inválida, vencido) devolve null
 * — nunca lança, porque atribuição ausente é um resultado de negócio válido
 * (checkout orgânico), não um erro.
 */
export function verifyAttributionCookie(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null

  const dotIndex = raw.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === raw.length - 1) return null
  const encoded = raw.slice(0, dotIndex)
  const signature = raw.slice(dotIndex + 1)

  let expected: string
  try {
    expected = hmac(encoded)
  } catch {
    return null
  }

  // Comparação em tempo constante — só depois de garantir mesmo comprimento
  // (timingSafeEqual lança se os buffers tiverem tamanhos diferentes).
  const sigBuf = Buffer.from(signature, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

  let payload: AttributionPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  } catch {
    return null
  }
  if (
    !payload ||
    typeof payload.affiliateId !== 'string' ||
    !payload.affiliateId ||
    typeof payload.expiresAt !== 'number'
  ) {
    return null
  }
  if (Date.now() > payload.expiresAt) return null

  return payload.affiliateId
}

function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) !== name) continue
    try {
      return decodeURIComponent(trimmed.slice(eq + 1))
    } catch {
      return trimmed.slice(eq + 1)
    }
  }
  return null
}

/** Lê e verifica o cookie ff_attr diretamente do request atual. */
export function getAttributionAffiliateId(request: Request): string | null {
  const raw = parseCookieHeader(request.headers.get('cookie'), ATTRIBUTION_COOKIE_NAME)
  return verifyAttributionCookie(raw)
}

/**
 * Grava o cookie ff_attr numa NextResponse, com os flags exigidos pelo
 * desenho: HttpOnly, Secure (produção), SameSite=Lax, Path=/.
 * Secure fica condicional a NODE_ENV=production para não quebrar o fluxo em
 * desenvolvimento local (HTTP puro) — mesmo padrão que o NextAuth já usa
 * internamente (cookie __Secure-* só em produção/HTTPS).
 */
export function setAttributionCookie(response: NextResponse, affiliateId: string): void {
  response.cookies.set(ATTRIBUTION_COOKIE_NAME, signAttributionCookie(affiliateId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
  })
}

/**
 * Prioridade de resolução da atribuição para uso em rotas de checkout
 * (§18.1/§18.7): User.referredByAffiliateId já congelado > cookie ff_attr
 * válido > null (checkout orgânico). Nunca lê `affiliateId` de corpo de
 * requisição — quem chama esta função não deve aceitar esse campo do
 * cliente para fins de atribuição.
 */
export function resolveCheckoutAffiliateId(params: {
  request: Request
  frozenAffiliateId?: string | null
}): string | null {
  if (params.frozenAffiliateId) return params.frozenAffiliateId
  return getAttributionAffiliateId(params.request)
}
