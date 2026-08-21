import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { getBaseUrl } from '@/lib/base-url'
import {
  resolverIdentidade,
  extrairParametros,
  montarDestino,
  registrarVisita,
  isIngestionBlockedForUser,
  getClientIp,
  COOKIE_VISITANTE,
  COOKIE_LEAD,
  COOKIE_SESSAO,
  SESSAO_TTL_S,
  VISITANTE_TTL_S,
} from '@/lib/tracking-link'

/**
 * Link rastreável: registra a visita e manda para a landing page.
 *
 * É o método de rastreamento sem instalação de código. O cliente põe este
 * endereço no anúncio; quem clica cai aqui, a visita é gravada com a origem, e
 * o navegador segue para o site real.
 *
 * ── Por que o dono não vem na URL ───────────────────────────────────────────
 *
 * O `slug` é opaco e resolve o dono no banco. Se o identificador do usuário
 * viajasse na URL — como acontece no tracker.js, onde `data-site` é o próprio
 * userId —, bastaria trocá-lo para registrar visitas na conta de outro cliente.
 * Aqui não há o que adulterar: um slug inexistente não vira visita de ninguém.
 *
 * O destino também sai do banco, nunca da query. Sem isso o link viraria
 * redirecionador aberto, útil para disfarçar phishing atrás do nosso domínio.
 *
 * ── Sobre falhar sem atrapalhar ─────────────────────────────────────────────
 *
 * Se o registro der erro, o redirecionamento acontece do mesmo jeito. Quem
 * clicou num anúncio quer chegar na página; perder uma linha de estatística é
 * incomparavelmente menos grave do que devolver erro para um visitante que o
 * cliente pagou para trazer.
 */
export const dynamic = 'force-dynamic'

/**
 * Cache do slug → destino, em memória do processo.
 *
 * Um clique de anúncio não pode esperar o banco. O destino de um link muda
 * raramente (só quando o dono edita), então guardá-lo por um minuto elimina a
 * ÚNICA consulta que ainda bloqueia o redirecionamento. Na segunda pessoa que
 * clica no mesmo anúncio, a resposta sai sem tocar no Postgres.
 *
 * TTL curto de propósito: editar o destino ou desativar o link passa a valer
 * em no máximo 60 segundos, o que é aceitável, e o processo reinicia a cada
 * deploy de qualquer forma.
 */
type SiteCache = { id: string; userId: string; destinationUrl: string; isActive: boolean }
const CACHE_TTL_MS = 60_000
const cacheDeSites = new Map<string, { valor: SiteCache | null; expiraEm: number }>()

function lerCache(slug: string): { valor: SiteCache | null } | null {
  const hit = cacheDeSites.get(slug)
  if (!hit) return null
  if (Date.now() > hit.expiraEm) {
    cacheDeSites.delete(slug)
    return null
  }
  return { valor: hit.valor }
}

function gravarCache(slug: string, valor: SiteCache | null) {
  // Teto para não virar vazamento de memória com slug inexistente sendo
  // sondado em massa. 5 mil entradas é folgado para qualquer volume real.
  if (cacheDeSites.size > 5000) cacheDeSites.clear()
  cacheDeSites.set(slug, { valor, expiraEm: Date.now() + CACHE_TTL_MS })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const url = new URL(request.url)

  // Slug malformado nem chega ao banco.
  const slug = (code || '').toLowerCase().trim()
  if (!slug || slug.length > 32 || !/^[a-z0-9]+$/.test(slug)) {
    return NextResponse.redirect(getBaseUrl(), { status: 302 })
  }

  const ip = getClientIp(request.headers)

  // Resolver o slug é a única coisa que PRECISA acontecer antes de responder —
  // sem o destino não há para onde mandar. Tudo o mais foi para depois do
  // redirecionamento (ver o bloco no fim).
  let site: SiteCache | null = null
  const doCache = lerCache(slug)
  if (doCache) {
    site = doCache.valor
  } else {
    try {
      site = await prisma.trackedSite.findUnique({
        where: { slug },
        select: { id: true, userId: true, destinationUrl: true, isActive: true },
      })
      gravarCache(slug, site)
    } catch (e) {
      console.error('[r/[code]] falha ao resolver slug:', e)
    }
  }

  // Slug desconhecido ou desativado: leva para a home do FlowSara em vez de
  // mostrar erro. Quem clicou não tem culpa nem contexto para entender um 404.
  if (!site || !site.isActive) {
    return NextResponse.redirect(getBaseUrl(), { status: 302 })
  }

  const identidade = resolverIdentidade({
    get: (name: string) => {
      const raw = request.headers.get('cookie') || ''
      const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
      return m ? { value: decodeURIComponent(m[1]) } : undefined
    },
  })

  const dados = extrairParametros(url.searchParams)
  const destino = montarDestino(site.destinationUrl, identidade, dados, url.searchParams)

  const res = NextResponse.redirect(destino, { status: 302 })

  // Cookies no domínio do FlowSara — o único disponível neste instante, já que
  // a landing do cliente ainda não carregou. Servem para reconhecer o mesmo
  // navegador num clique futuro e manter a jornada contínua.
  //
  // httpOnly: nada em JavaScript precisa lê-los; quem continua a jornada dentro
  // da página recebe os mesmos valores pela query do redirecionamento.
  const comum = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/' }
  res.cookies.set(COOKIE_VISITANTE, identidade.visitorId, { ...comum, maxAge: VISITANTE_TTL_S })
  res.cookies.set(COOKIE_LEAD, identidade.leadId, { ...comum, maxAge: VISITANTE_TTL_S })
  res.cookies.set(COOKIE_SESSAO, identidade.sessionId, { ...comum, maxAge: SESSAO_TTL_S })

  // ── Registro DEPOIS da resposta ───────────────────────────────────────────
  //
  // Nada aqui é aguardado. Antes era, e o custo aparecia inteiro no tempo de
  // carregamento: limite por IP (1 ida ao banco), conta bloqueada (1) e
  // registrarVisita (4 — upsert do lead, upsert da sessão, create do evento,
  // update do site). Seis idas em SÉRIE a um Postgres em outra região, somadas
  // aos 300ms de cada uma, faziam o anúncio levar de 8 a 10 segundos para
  // abrir a página. Quem clicou pagava a conta de uma estatística que não é
  // dele.
  //
  // O arquivo já dizia, no topo, que perder uma linha de estatística é
  // incomparavelmente menos grave do que atrapalhar um visitante pago. A regra
  // estava escrita; o código é que ainda esperava.
  //
  // Isto funciona porque o app roda como processo Node persistente (PM2): o
  // trabalho continua depois da resposta ir embora. Num ambiente serverless
  // seria preciso `waitUntil`.
  const headerReferer = request.headers.get('referer')
  const headerUserAgent = request.headers.get('user-agent')

  void (async () => {
    try {
      // Teto por IP: o link é público e um robô poderia inflar as estatísticas
      // do cliente. Generoso o bastante para não atrapalhar tráfego real.
      const rl = await checkRateLimit(`track:link:${ip}`, 120, 60_000)
      if (!rl.ok) return

      // Plano vencido ou teste expirado param a ENTRADA de dados, como já
      // acontece nos webhooks e no tracker (ver lib/account-status.ts). O
      // visitante continua chegando na página do cliente — quem perdeu o
      // direito é a conta, não quem clicou no anúncio.
      if (await isIngestionBlockedForUser(site.userId)) return

      await registrarVisita({
        userId: site.userId,
        siteId: site.id,
        identidade,
        dados,
        destino,
        referrer: headerReferer,
        ip,
        userAgent: headerUserAgent,
      })
    } catch (e) {
      console.error('[r/[code]] falha ao registrar visita:', e)
    }
  })()

  return res
}
