import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const base = getBaseUrl()
  const siteId = session.user.id
  const snippet = `<script async src="${base}/tracker.js" data-site="${siteId}"></script>`
  const conversionSnippet = `<script async src="${base}/flowfunnel-conversion.js" data-site="${siteId}"></script>`

  return NextResponse.json({
    siteId,
    scriptUrl: `${base}/tracker.js`,
    snippet,
    conversionScriptUrl: `${base}/flowfunnel-conversion.js`,
    conversionSnippet,
    instructions: {
      headTag: 'Cole no <head> da sua landing page (qualquer plataforma: WordPress, ClickFunnels, HTML estático, etc).',
      buttons: 'Em qualquer botão extra, chame: window.trackEvent("nome_do_evento")',
      conversion: 'Após uma compra confirmada, chame: window.zfTrackConversion(valor, "produto", { order_id: "ID_DO_PEDIDO" })',
      thankYouPage:
        'Na página de obrigado do seu checkout, cole o snippet de conversão. Ele vincula a venda ao clique original automaticamente (atribuição determinística).',
    },
  })
}
