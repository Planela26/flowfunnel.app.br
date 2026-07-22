import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// SEGURANÇA: nunca confiar no header Host (Host header injection / cache poisoning).
// Preferimos NEXTAUTH_URL (configurado pelo operador) e, em desenvolvimento,
// caímos para o REPLIT_DEV_DOMAIN.
function getPublicBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const replitDev = process.env.REPLIT_DEV_DOMAIN
  if (replitDev) return `https://${replitDev}`

  // Último recurso: usa o origin da própria request (não o header Host).
  try {
    const u = new URL(request.url)
    return `${u.protocol}//${u.host}`
  } catch {
    return 'http://localhost:5000'
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const base = getPublicBaseUrl(request)
  const siteId = session.user.id
  const snippet = `<script async src="${base}/tracker.js" data-site="${siteId}"></script>`

  return NextResponse.json({
    siteId,
    scriptUrl: `${base}/tracker.js`,
    snippet,
    instructions: {
      headTag: 'Cole no <head> da sua landing page (qualquer plataforma: WordPress, ClickFunnels, HTML estático, etc).',
      buttons: 'Em qualquer botão extra, chame: window.trackEvent("nome_do_evento")',
      conversion: 'Após uma compra confirmada, chame: window.zfTrackConversion(valor, "produto")',
    },
  })
}
