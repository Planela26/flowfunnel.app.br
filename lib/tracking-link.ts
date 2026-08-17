/**
 * Rastreamento por link — o método sem instalação de código.
 *
 * O cliente cadastra a URL da landing page, recebe um link do FlowSara e usa
 * esse link nos anúncios. Quem clica passa por /r/<slug>, que registra a visita
 * e redireciona para o site real.
 *
 * ── O que este método cobre, e o que não cobre ──────────────────────────────
 *
 * O link enxerga UM instante: o clique. Ele registra origem, campanha, UTMs,
 * visitante e sessão — mas depois disso o navegador está no site do cliente, e
 * sem código lá dentro o FlowSara não vê navegação, clique no WhatsApp nem
 * clique no checkout.
 *
 * A atribuição de VENDA depende justamente do que acontece lá dentro: o
 * tracker.js injeta o `lead_id` no link de checkout usando o parâmetro nativo
 * de cada plataforma (sck no Hotmart, s1 na Kiwify, src na Monetizze…), e é
 * esse valor que volta no webhook e permite casar venda com clique com
 * confiança 1 (ver lib/attribution.ts).
 *
 * Por isso o redirecionamento leva o `lead_id` na query: se a landing tiver o
 * tracker instalado, ele ADOTA esse lead_id em vez de gerar outro. Os dois
 * métodos deixam de competir e passam a se somar — o link garante a origem, o
 * tracker fecha a venda no mesmo identificador.
 */

import { prismaAdmin as prisma } from './prisma'
import { getClientIp } from './security-utils'
import { isIngestionBlockedForUser } from './account-status'

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I): o cliente vai ler e digitar
// esse link em anúncio, e uma confusão de caractere manda tráfego para lugar
// nenhum — ou, pior, para o link de outro cliente.
const ALFABETO = '23456789abcdefghijkmnpqrstuvwxyz'
const TAMANHO_SLUG = 8

export function generateSlug(): string {
  const bytes = new Uint8Array(TAMANHO_SLUG)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < TAMANHO_SLUG; i++) out += ALFABETO[bytes[i] % ALFABETO.length]
  return out
}

export type DestinoValidado =
  | { ok: true; url: string }
  | { ok: false; error: string }

/**
 * Valida a URL de destino no CADASTRO, não no clique.
 *
 * Guardar só URL validada é o que impede o link do FlowSara de virar
 * redirecionador aberto: no clique, o destino sai do banco e nunca da query.
 */
export function validateDestination(raw: unknown): DestinoValidado {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Informe a URL da sua landing page.' }
  }

  let texto = raw.trim()
  // Quem digita "meusite.com.br" espera que funcione; assumir https é mais
  // gentil que recusar por falta de esquema.
  if (!/^https?:\/\//i.test(texto)) texto = `https://${texto}`

  let u: URL
  try {
    u = new URL(texto)
  } catch {
    return { ok: false, error: 'URL inválida. Exemplo: https://meusite.com.br' }
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'A URL precisa começar com http:// ou https://' }
  }

  const host = u.hostname.toLowerCase()

  // Sem ponto no host não é domínio público (localhost, nomes de rede interna).
  if (!host.includes('.')) {
    return { ok: false, error: 'Informe um domínio público. Exemplo: https://meusite.com.br' }
  }

  // Endereços locais e de rede privada não fazem sentido como landing page e
  // transformariam o link numa sonda para dentro da infraestrutura.
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return { ok: false, error: 'Endereços locais ou de rede interna não podem ser usados.' }
  }

  return { ok: true, url: u.toString() }
}

// ── Identidade do visitante ─────────────────────────────────────────────────
//
// No tracker.js a identidade nasce no localStorage do site do cliente. Aqui ela
// nasce no servidor, em cookie do domínio do FlowSara — é o único lugar que
// existe no momento do clique, já que a landing ainda nem carregou.
export const COOKIE_VISITANTE = 'fs_vid'
export const COOKIE_LEAD = 'fs_lid'
export const COOKIE_SESSAO = 'fs_sid'
export const SESSAO_TTL_S = 30 * 60
export const VISITANTE_TTL_S = 365 * 24 * 60 * 60

function novoId(prefixo: string): string {
  return `${prefixo}${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const CLICK_IDS = ['fbclid', 'gclid', 'ttclid', 'msclkid'] as const

export type IdentidadeVisita = {
  leadId: string
  visitorId: string
  sessionId: string
  novoVisitante: boolean
}

/**
 * Resolve a identidade a partir dos cookies, criando o que faltar.
 *
 * O leadId é reaproveitado entre cliques do mesmo navegador de propósito: ele
 * representa a JORNADA de compra, não o clique. Se cada clique gerasse um lead
 * novo, a venda que chegasse depois seria atribuída a um lead sem histórico.
 */
export function resolverIdentidade(cookies: {
  get(name: string): { value: string } | undefined
}): IdentidadeVisita {
  const vidAtual = cookies.get(COOKIE_VISITANTE)?.value
  const lidAtual = cookies.get(COOKIE_LEAD)?.value
  const sidAtual = cookies.get(COOKIE_SESSAO)?.value

  return {
    visitorId: vidAtual || novoId('v_'),
    leadId: lidAtual || novoId('l_'),
    // A sessão expira sozinha pelo maxAge do cookie: ausente = sessão nova.
    sessionId: sidAtual || novoId('s_'),
    novoVisitante: !vidAtual,
  }
}

export type DadosDaVisita = {
  utm: Partial<Record<(typeof UTM_KEYS)[number], string>>
  clickIds: Partial<Record<(typeof CLICK_IDS)[number], string>>
}

/** Lê UTMs e click IDs da URL do clique. */
export function extrairParametros(params: URLSearchParams): DadosDaVisita {
  const utm: any = {}
  const clickIds: any = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)
    if (v) utm[k] = v.slice(0, 200)
  }
  for (const k of CLICK_IDS) {
    const v = params.get(k)
    if (v) clickIds[k] = v.slice(0, 400)
  }
  return { utm, clickIds }
}

/**
 * Monta a URL final para onde o navegador é enviado.
 *
 * Carrega o `lead_id` para o tracker adotar (é isto que liga o link à venda) e
 * repassa as UTMs, para que qualquer outra ferramenta na página — Meta Pixel,
 * Google Analytics — continue enxergando a origem como enxergaria num clique
 * direto. Parâmetros que o cliente já tenha colocado no destino são
 * preservados: nunca sobrescrevemos o que ele configurou.
 */
export function montarDestino(
  destinationUrl: string,
  identidade: IdentidadeVisita,
  dados: DadosDaVisita,
  extras: URLSearchParams,
): string {
  const u = new URL(destinationUrl)

  if (!u.searchParams.has('lead_id')) u.searchParams.set('lead_id', identidade.leadId)
  if (!u.searchParams.has('fs_vid')) u.searchParams.set('fs_vid', identidade.visitorId)
  if (!u.searchParams.has('fs_sid')) u.searchParams.set('fs_sid', identidade.sessionId)

  for (const [k, v] of Object.entries({ ...dados.utm, ...dados.clickIds })) {
    if (v && !u.searchParams.has(k)) u.searchParams.set(k, v)
  }

  // Qualquer outro parâmetro que o anúncio tenha trazido segue adiante — quem
  // usa parâmetros próprios (id de criativo, teste A/B) não pode perdê-los só
  // por ter passado pelo nosso link.
  const conhecidos = new Set<string>([...UTM_KEYS, ...CLICK_IDS, 'lead_id', 'fs_vid', 'fs_sid'])
  extras.forEach((v, k) => {
    if (!conhecidos.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, v)
  })

  return u.toString()
}

/**
 * Grava a visita nas mesmas tabelas que o tracker.js alimenta.
 *
 * Reaproveitar TrackedLead/TrackedSession/TrackedEvent é o que faz os dois
 * métodos conviverem: relatórios, jornada do lead e atribuição de venda leem
 * daqui e não precisam saber por qual caminho a visita entrou.
 */
export async function registrarVisita(params: {
  userId: string
  siteId: string
  identidade: IdentidadeVisita
  dados: DadosDaVisita
  destino: string
  referrer: string | null
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  const { userId, siteId, identidade, dados, destino, referrer, ip, userAgent } = params
  const { leadId, visitorId, sessionId } = identidade

  await prisma.trackedLead.upsert({
    where: { userId_leadId: { userId, leadId } },
    // Último clique vence: quem volta por outra campanha passa a ser atribuído
    // à campanha nova. `?? undefined` preserva o valor antigo quando o clique
    // atual não trouxe o parâmetro, em vez de apagá-lo.
    update: {
      utmSource: dados.utm.utm_source ?? undefined,
      utmCampaign: dados.utm.utm_campaign ?? undefined,
      utmMedium: dados.utm.utm_medium ?? undefined,
      utmContent: dados.utm.utm_content ?? undefined,
      utmTerm: dados.utm.utm_term ?? undefined,
      fbclid: dados.clickIds.fbclid ?? undefined,
      gclid: dados.clickIds.gclid ?? undefined,
      ttclid: dados.clickIds.ttclid ?? undefined,
      msclkid: dados.clickIds.msclkid ?? undefined,
      visitorId,
    },
    create: {
      userId,
      leadId,
      visitorId,
      utmSource: dados.utm.utm_source || null,
      utmCampaign: dados.utm.utm_campaign || null,
      utmMedium: dados.utm.utm_medium || null,
      utmContent: dados.utm.utm_content || null,
      utmTerm: dados.utm.utm_term || null,
      fbclid: dados.clickIds.fbclid || null,
      gclid: dados.clickIds.gclid || null,
      ttclid: dados.clickIds.ttclid || null,
      msclkid: dados.clickIds.msclkid || null,
      firstUrl: destino,
      referrer,
      ipAddress: ip,
      userAgent,
    },
  })

  await prisma.trackedSession.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    update: { lastSeen: new Date() },
    create: { userId, sessionId, visitorId, leadId, firstUrl: destino, referrer },
  })

  await prisma.trackedEvent.create({
    data: {
      userId,
      leadId,
      sessionId,
      eventName: 'link_click',
      url: destino,
      metadata: JSON.stringify({ siteId, via: 'tracking_link' }),
    },
  })

  await prisma.trackedSite.update({
    where: { id: siteId },
    data: { lastVisitAt: new Date(), visitCount: { increment: 1 } },
  })
}

export { isIngestionBlockedForUser, getClientIp }
