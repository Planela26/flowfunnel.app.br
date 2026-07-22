import { verifyTOTP } from './totp'
import { hashRecoveryCode, normalizeRecoveryCode } from './recovery-codes'

// Decisão de verificação de 2FA — função PURA (sem I/O), pra ser testável.
// Recebe o secret e os hashes dos códigos de recuperação NÃO usados, e decide
// se o código informado é um TOTP válido ou um código de recuperação válido.

export type TwoFactorResult =
  | { ok: true; method: 'totp' | 'recovery' | 'not_required'; usedRecoveryHash?: string }
  | { ok: false; reason: 'no_code' | 'invalid_code' }

const TOTP_DIGITS = 6

export function checkTwoFactorCode(params: {
  code: string
  secretBase32: string | null
  recoveryHashes: string[]
}): TwoFactorResult {
  const raw = (params.code || '').trim()
  if (!raw) return { ok: false, reason: 'no_code' }

  const digitsOnly = raw.replace(/\s+/g, '')
  // Um TOTP é exatamente 6 dígitos. Recovery codes são alfanuméricos (10 chars),
  // então nunca colidem com o formato TOTP.
  if (/^\d{6}$/.test(digitsOnly)) {
    if (params.secretBase32 && verifyTOTP(digitsOnly, params.secretBase32, { digits: TOTP_DIGITS })) {
      return { ok: true, method: 'totp' }
    }
    return { ok: false, reason: 'invalid_code' }
  }

  // Caso contrário, tenta como código de recuperação.
  const normalized = normalizeRecoveryCode(raw)
  if (normalized.length > 0) {
    const hash = hashRecoveryCode(raw)
    if (params.recoveryHashes.includes(hash)) {
      return { ok: true, method: 'recovery', usedRecoveryHash: hash }
    }
  }
  return { ok: false, reason: 'invalid_code' }
}

// Decisão completa considerando se o 2FA está habilitado para a conta.
export function evaluateTwoFactor(params: {
  enabled: boolean
  code: string
  secretBase32: string | null
  recoveryHashes: string[]
}): TwoFactorResult {
  if (!params.enabled) return { ok: true, method: 'not_required' }
  return checkTwoFactorCode({
    code: params.code,
    secretBase32: params.secretBase32,
    recoveryHashes: params.recoveryHashes,
  })
}
