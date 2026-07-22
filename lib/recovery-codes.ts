import crypto from 'crypto'

// Códigos de recuperação de 2FA. Geramos códigos aleatórios de alta entropia e
// armazenamos apenas o hash SHA-256 (o código em texto puro só é mostrado uma
// vez, no momento da geração). Por serem aleatórios e longos, SHA-256 é
// suficiente (mesma abordagem dos tokens de reset de senha).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I para evitar confusão
const GROUP_LEN = 5
const GROUPS = 2 // formato XXXXX-XXXXX (10 chars)

export const RECOVERY_CODE_COUNT = 10

function randomCode(): string {
  const parts: string[] = []
  for (let g = 0; g < GROUPS; g++) {
    let part = ''
    const bytes = crypto.randomBytes(GROUP_LEN)
    for (let i = 0; i < GROUP_LEN; i++) {
      part += ALPHABET[bytes[i] % ALPHABET.length]
    }
    parts.push(part)
  }
  return parts.join('-')
}

// Normaliza para comparação: caixa alta, sem hífens/espaços.
export function normalizeRecoveryCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex')
}

// Gera N códigos novos: retorna os códigos em texto puro (pra mostrar ao
// usuário UMA vez) e os hashes (pra persistir no banco).
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): {
  codes: string[]
  hashes: string[]
} {
  const codes: string[] = []
  const seen = new Set<string>()
  while (codes.length < count) {
    const c = randomCode()
    if (seen.has(c)) continue
    seen.add(c)
    codes.push(c)
  }
  return { codes, hashes: codes.map(hashRecoveryCode) }
}
