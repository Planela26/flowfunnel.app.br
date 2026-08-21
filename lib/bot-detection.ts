/**
 * Identifica tráfego automatizado pelo User-Agent.
 *
 * As rotas de rastreamento tinham limite por IP, mas nada que olhasse QUEM
 * estava acessando. Toda visita virava um `TrackedLead` — inclusive robô de
 * busca, verificador de disponibilidade, scanner de SEO e crawler de rede
 * social. O resultado foi uma conta com centenas de "visitantes" para um
 * punhado de cliques reais no anúncio: número que não descreve nada e, pior,
 * some no meio dos que descrevem.
 *
 * Robô não é visitante. Não clicou em anúncio, não vai comprar, e contá-lo
 * estraga toda taxa que tenha visita no denominador — conversão, custo por
 * lead, engajamento.
 *
 * A lista cobre o que aparece de fato em log de site: buscadores, prévia de
 * link em rede social, ferramentas de SEO, monitores de uptime e as
 * bibliotecas de requisição usadas em automação. Não pretende ser exaustiva —
 * é impossível — e sim remover o volume óbvio.
 *
 * Deliberadamente NÃO bloqueia nada: a página continua sendo servida
 * normalmente, o redirecionamento do link rastreável continua acontecendo. O
 * único efeito é a visita não ser contabilizada.
 */

const PADROES_DE_ROBO = [
  // Buscadores e indexadores
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'sogou', 'exabot', 'ia_archiver', 'applebot', 'petalbot', 'bytespider',
  // Prévia de link em redes sociais e mensageiros
  'facebookexternalhit', 'facebookcatalog', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot', 'discordbot', 'slackbot', 'pinterest',
  'redditbot', 'embedly', 'skypeuripreview', 'vkshare', 'quora link preview',
  // SEO, marketing e análise
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'rogerbot', 'screaming frog',
  'seokicks', 'sistrix', 'dataforseo', 'serpstatbot', 'barkrowler',
  // Monitores de disponibilidade e performance
  'uptimerobot', 'pingdom', 'statuscake', 'site24x7', 'gtmetrix',
  'lighthouse', 'chrome-lighthouse', 'pagespeed', 'newrelicpinger',
  // Bibliotecas e ferramentas de automação
  'curl/', 'wget/', 'python-requests', 'python-urllib', 'go-http-client',
  'java/', 'okhttp', 'axios/', 'node-fetch', 'got/', 'httpclient',
  'postmanruntime', 'insomnia', 'headlesschrome', 'phantomjs', 'puppeteer',
  'playwright', 'selenium', 'scrapy',
  // Genéricos — por último, porque casam largo
  'bot/', 'bot;', 'spider', 'crawler', 'crawling', 'scraper', 'archiver',
  'monitoring', 'preview',
]

/**
 * `true` quando o User-Agent parece automação.
 *
 * User-Agent ausente ou vazio também conta: navegador de pessoa sempre manda
 * um, e requisição sem ele vem de script.
 */
export function pareceRobo(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true
  const ua = userAgent.toLowerCase()
  if (ua.length < 12) return true
  return PADROES_DE_ROBO.some(p => ua.includes(p))
}
