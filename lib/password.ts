// Política central de senha forte. Usada em registro, reset e troca de senha
// para garantir o mesmo critério em todos os pontos de entrada.
//
// Critério (baseline pragmático, sem frustrar o usuário):
// - mínimo de 8 caracteres
// - ao menos uma letra e ao menos um número
// - máximo de 128 caracteres (evita custo excessivo de hashing / DoS)

const MIN_LENGTH = 8
const MAX_LENGTH = 128

export function validatePasswordStrength(password: unknown): { ok: boolean; error?: string } {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Senha inválida' }
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, error: `A senha deve ter pelo menos ${MIN_LENGTH} caracteres` }
  }
  if (password.length > MAX_LENGTH) {
    return { ok: false, error: `A senha deve ter no máximo ${MAX_LENGTH} caracteres` }
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, error: 'A senha deve conter pelo menos uma letra' }
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: 'A senha deve conter pelo menos um número' }
  }
  return { ok: true }
}
