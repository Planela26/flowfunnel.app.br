/**
 * Retorna a URL base pública da aplicação.
 *
 * Ordem de prioridade:
 * 1. NEXTAUTH_URL  — URL canônica do domínio público (Hostinger → https://flowfunnel.app.br
 *    OU o subdomínio *.hostingersite.com até o domínio custom estar propagado)
 * 2. NEXT_PUBLIC_APP_URL — alternativa explícita
 * 3. localhost:5000 — só em desenvolvimento local sem Replit
 *
 * IMPORTANTE: Em dev no Replit, lib/auth.ts já seta
 *   process.env.NEXTAUTH_URL = `https://${REPLIT_DEV_DOMAIN}`
 * então NEXTAUTH_URL está sempre disponível em dev.
 * Nenhum código fora deste arquivo deve referenciar REPLIT_DEV_DOMAIN
 * para geração de URLs — isso causaria URLs de desenvolvimento vazando
 * para campanhas/e-mails de produção.
 *
 * PRODUÇÃO ESTÁVEL: até o domínio custom (flowfunnel.app.br) estar
 * apontando para a Hostinger via DNS, use o subdomínio *.hostingersite.com
 * que é o endereço real que a Hostinger serve. Após a propagação DNS,
 * troque apenas o valor da env, sem mudar código.
 */
export function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL

  // Em prod exige NEXTAUTH_URL. Em dev aceita fallback localhost.
  if (url) return url.replace(/\/$/, '')

  if (process.env.NODE_ENV !== 'production') return 'http://localhost:5000'

  // Produção sem NEXTAUTH_URL → erro explícito (não silencia)
  throw new Error(
    '[FlowFunnel] NEXTAUTH_URL não está configurado. ' +
    'Defina a variável de ambiente na Hostinger (hPanel → Node.js → Variáveis de Ambiente). ' +
    'Use https://flowfunnel-app-br-931067.hostingersite.com enquanto o domínio ' +
    'flowfunnel.app.br não estiver propagado, depois troque para https://flowfunnel.app.br.'
  )
}
