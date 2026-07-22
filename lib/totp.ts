import crypto from 'crypto'

// Implementação de TOTP (RFC 6238) e HOTP (RFC 4226) usando apenas o módulo
// crypto nativo do Node — sem dependências externas. Compatível com Google
// Authenticator, Microsoft Authenticator e Authy (SHA-1, 6 dígitos, passo 30s).

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export type TotpOptions = {
  step?: number
  digits?: number
  algorithm?: 'sha1' | 'sha256' | 'sha512'
}

const DEFAULTS: Required<TotpOptions> = { step: 30, digits: 6, algorithm: 'sha1' }

// Codifica um Buffer em Base32 (RFC 4648, sem padding) — usado para gerar o
// secret que o usuário escaneia no app autenticador.
export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

// Decodifica uma string Base32 em Buffer. Ignora espaços, padding e caixa.
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) throw new Error('Secret Base32 inválido')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// Gera um secret aleatório (20 bytes = 160 bits, recomendado pela RFC 4226)
// já em Base32, pronto pra ser exibido / colocado no otpauth URI.
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes))
}

// HOTP (RFC 4226): código a partir de um contador.
function hotp(secret: Buffer, counter: number, digits: number, algorithm: string): string {
  const counterBuf = Buffer.alloc(8)
  // Big-endian de 64 bits. counter cabe com folga em Number até 2^53.
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = tmp & 0xff
    tmp = Math.floor(tmp / 256)
  }
  const hmac = crypto.createHmac(algorithm, secret).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  const otp = binary % 10 ** digits
  return otp.toString().padStart(digits, '0')
}

// Gera o código TOTP para um instante (em segundos; default = agora).
export function generateTOTP(
  secretBase32: string,
  timeSeconds: number = Math.floor(Date.now() / 1000),
  options: TotpOptions = {},
): string {
  const { step, digits, algorithm } = { ...DEFAULTS, ...options }
  const secret = base32Decode(secretBase32)
  const counter = Math.floor(timeSeconds / step)
  return hotp(secret, counter, digits, algorithm)
}

// Verifica um token TOTP aceitando uma janela de deriva de relógio (±window
// passos). Comparação em tempo constante para evitar timing attacks.
export function verifyTOTP(
  token: string,
  secretBase32: string,
  options: TotpOptions & { window?: number; timeSeconds?: number } = {},
): boolean {
  const { step, digits, algorithm } = { ...DEFAULTS, ...options }
  const window = options.window ?? 1
  const time = options.timeSeconds ?? Math.floor(Date.now() / 1000)
  const normalized = (token || '').replace(/\s+/g, '')
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) return false
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const candidate = generateTOTP(secretBase32, time + errorWindow * step, { step, digits, algorithm })
    if (timingSafeEqualStr(candidate, normalized)) return true
  }
  return false
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Monta a URI otpauth:// que vira o QR Code escaneado pelos apps autenticadores.
export function buildOtpauthUri(params: {
  secretBase32: string
  accountName: string
  issuer?: string
  digits?: number
  step?: number
  algorithm?: 'sha1' | 'sha256' | 'sha512'
}): string {
  const issuer = params.issuer ?? 'FlowFunnel'
  const digits = params.digits ?? DEFAULTS.digits
  const step = params.step ?? DEFAULTS.step
  const algorithm = (params.algorithm ?? DEFAULTS.algorithm).toUpperCase()
  const label = encodeURIComponent(`${issuer}:${params.accountName}`)
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(step),
  })
  return `otpauth://totp/${label}?${query.toString()}`
}
