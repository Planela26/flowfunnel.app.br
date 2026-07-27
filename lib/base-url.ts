/**
 * Retorna a URL base pública da aplicação.
 *
 * Ordem de prioridade:
 * 1. NEXTAUTH_URL  — configurado pelo operador (Hostinger → deve ser https://flowfunnel.app.br)
 * 2. NEXT_PUBLIC_APP_URL — alternativa explícita
 * 3. localhost:5000 — só em desenvolvimento local sem Replit
 *
 * IMPORTANTE: Em dev no Replit, lib/auth.ts já seta
 *   process.env.NEXTAUTH_URL = `https://${REPLIT_DEV_DOMAIN}`
 * então NEXTAUTH_URL está sempre disponível tanto em dev quanto em prod.
 * Nenhum código fora deste arquivo deve referenciar REPLIT_DEV_DOMAIN
 * para geração de URLs — isso causaria URLs de desenvolvimento vazando
 * para campanhas/e-mails de produção.
 */
export function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL
  if (url) return url.replace(/\/$/, '')

  // Último recurso: apenas em dev local (sem Replit, sem NEXTAUTH_URL)
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:5000'

  // Produção sem NEXTAUTH_URL → erro explícito (não silencia)
  throw new Error(
    '[FlowFunnel] NEXTAUTH_URL não está configurado. ' +
    'Defina a variável de ambiente na Hostinger antes de fazer deploy.'
  )
}
