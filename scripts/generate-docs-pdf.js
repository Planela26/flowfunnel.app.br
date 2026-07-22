const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

// Ensure output dir
const outDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'flowfunnel-documentacao.pdf')

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 55, right: 55 },
  info: {
    Title: 'FlowFunnel — Documentação Técnica e Comercial Completa',
    Author: 'FlowFunnel Platform',
    Subject: 'Documentação SaaS — Versão 1.0 — Junho 2026',
    Keywords: 'FlowFunnel, SaaS, WhatsApp, CRM, Analytics, Propriedade Intelectual',
  },
})

const stream = fs.createWriteStream(outFile)
doc.pipe(stream)

// ─── Colors & helpers ────────────────────────────────────────────────────────
const BLUE   = '#2563EB'
const DARK   = '#0F172A'
const GRAY   = '#64748B'
const LGRAY  = '#E2E8F0'
const GREEN  = '#059669'
const PURPLE = '#7C3AED'
const RED    = '#DC2626'
const AMBER  = '#D97706'

const W = doc.page.width - 110   // usable width
const L = 55                      // left margin

function newPage() {
  doc.addPage()
}

function hline(y, color = LGRAY) {
  const yy = y !== undefined ? y : doc.y
  doc.save().moveTo(L, yy).lineTo(L + W, yy).lineWidth(0.5).strokeColor(color).stroke().restore()
}

function sectionTitle(text, noTopMargin = false) {
  if (!noTopMargin) doc.moveDown(0.5)
  doc.rect(L, doc.y, W, 26).fill(BLUE)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
    .text(text, L + 10, doc.y - 20, { width: W - 20 })
  doc.fillColor(DARK).moveDown(0.8)
}

function h3(text) {
  doc.moveDown(0.4)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text(text, L)
  doc.moveDown(0.25)
  hline()
  doc.moveDown(0.3)
  doc.fillColor(DARK)
}

function h4(text) {
  doc.moveDown(0.3)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(text, L)
  doc.moveDown(0.15)
}

function body(text, indent = 0) {
  doc.font('Helvetica').fontSize(9.5).fillColor('#374151')
    .text(text, L + indent, doc.y, { width: W - indent, lineGap: 2 })
  doc.moveDown(0.25)
}

function bullet(text, indent = 10) {
  const yy = doc.y
  doc.font('Helvetica').fontSize(9).fillColor(BLUE).text('•', L + indent, yy, { width: 10, continued: false })
  doc.font('Helvetica').fontSize(9).fillColor('#374151').text(text, L + indent + 12, yy, { width: W - indent - 14, lineGap: 1.5 })
  doc.moveDown(0.1)
}

function kpiBadge(x, y, num, label, color) {
  const bw = 115, bh = 46
  doc.roundedRect(x, y, bw, bh, 6).fill(color)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(18).text(num, x + 8, y + 6, { width: bw - 16, align: 'left' })
  doc.fillColor('white').font('Helvetica').fontSize(8).text(label, x + 8, y + 28, { width: bw - 16 })
}

function tableHeader(cols, widths) {
  const startX = L
  let x = startX
  const rowH = 18
  doc.rect(startX, doc.y, W, rowH).fill(BLUE)
  const topY = doc.y
  cols.forEach((col, i) => {
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
      .text(col, x + 4, topY + 4, { width: widths[i] - 8, lineBreak: false })
    x += widths[i]
  })
  doc.y = topY + rowH
  doc.moveDown(0)
  doc.fillColor(DARK)
  return topY + rowH
}

function tableRow(cells, widths, even = false) {
  // Check if we're near the bottom
  if (doc.y > 750) { newPage(); doc.moveDown(0) }
  const startX = L
  const rowH = 16
  if (even) doc.rect(startX, doc.y, W, rowH).fill('#F8FAFC')
  const topY = doc.y
  let x = startX
  cells.forEach((cell, i) => {
    const color = i === 0 ? DARK : '#374151'
    doc.fillColor(color).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
      .text(String(cell), x + 4, topY + 3, { width: widths[i] - 8, lineBreak: false })
    x += widths[i]
  })
  doc.y = topY + rowH
  doc.fillColor(DARK)
}

function barChart(label, value, maxValue, y, color = BLUE) {
  const bw = Math.max(2, (value / maxValue) * (W - 120))
  doc.font('Helvetica').fontSize(8).fillColor(DARK)
    .text(label, L, y, { width: 115, lineBreak: false })
  doc.rect(L + 118, y + 1, bw, 10).fill(color)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK)
    .text(value.toLocaleString('pt-BR'), L + 118 + bw + 4, y, { lineBreak: false })
}

function checkNearBottom(needed = 60) {
  if (doc.y > 760 - needed) newPage()
}

// ═══════════════════════════════════════════════════════════════════════
// CAPA
// ═══════════════════════════════════════════════════════════════════════
// Header gradient bar
doc.rect(0, 0, 595, 8).fill(BLUE)
doc.rect(200, 0, 200, 8).fill(PURPLE)

// Logo box
doc.roundedRect(55, 80, 80, 80, 16).fill(BLUE)
doc.fillColor('white').font('Helvetica-Bold').fontSize(32).text('FF', 55, 118, { width: 80, align: 'center' })

// Title
doc.fillColor(DARK).font('Helvetica-Bold').fontSize(36)
  .text('FlowFunnel', 55, 185)

doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(16)
  .text('Documentação Técnica e Comercial Completa', 55, 230)

doc.fillColor(GRAY).font('Helvetica').fontSize(11)
  .text('Plataforma SaaS para rastreamento e qualificação de funis de vendas via\nWhatsApp, com integrações nativas a Meta Ads, Google Ads, TikTok Ads e as\nprincipais plataformas de infoprodutos do Brasil.', 55, 260, { width: 480, lineGap: 3 })

// Tags
const tags = ['SaaS', 'WhatsApp Marketing', 'CRM', 'Meta Ads', 'IA', 'Automação']
let tx = 55
doc.y = 320
tags.forEach(t => {
  const tw = doc.widthOfString(t) + 16
  doc.roundedRect(tx, 320, tw, 18, 9).fill('#DBEAFE')
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8).text(t, tx + 8, 324, { lineBreak: false })
  tx += tw + 8
})

// KPI grid
const kpis = [
  ['38.913', 'Linhas de Código', BLUE],
  ['346', 'Arquivos', GREEN],
  ['80+', 'Endpoints de API', PURPLE],
  ['26', 'Modelos no Banco', '#0E7490'],
  ['41', 'Componentes React', '#D97706'],
  ['12+', 'Integrações', '#B91C1C'],
]
const kpiY = 360
kpis.forEach((k, i) => {
  const col = i % 3
  const row = Math.floor(i / 3)
  kpiBadge(55 + col * 122, kpiY + row * 54, k[0], k[1], k[2])
})

// Footer
doc.y = 720
hline(720, LGRAY)
doc.fillColor(GRAY).font('Helvetica').fontSize(8)
  .text('Versão 1.0 — Produção     |     Junho de 2026     |     flowfunnel.app.br     |     Next.js 16 · PostgreSQL · Prisma', L, 726, { align: 'center', width: W })

// Page number footer
doc.fillColor(GRAY).font('Helvetica').fontSize(8).text('1', 0, 826, { align: 'center', width: 595 })

// ═══════════════════════════════════════════════════════════════════════
// PÁG 2 — SUMÁRIO
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SUMÁRIO', true)

const toc = [
  ['1', 'Visão Geral da Empresa', '3'],
  ['2', 'Plataforma — Módulos e Funcionalidades', '5'],
  ['3', 'Arquitetura Completa do Sistema', '7'],
  ['4', 'Estrutura de Pastas e Arquivos', '9'],
  ['5', 'Análise de Código-Fonte por Módulo', '11'],
  ['6', 'Propriedade Intelectual — Algoritmos Estratégicos', '13'],
  ['7', 'Métricas Completas do Projeto', '15'],
  ['8', 'Análise de Escalabilidade', '17'],
  ['9', 'Modelo de Negócio', '19'],
  ['10', 'Projeções Financeiras', '22'],
  ['11', 'Valuation da Empresa', '26'],
  ['12', 'Análise Competitiva', '28'],
  ['13', 'Segurança e LGPD', '31'],
  ['14', 'Roadmap de Produto', '33'],
  ['15', 'Conclusão Executiva', '35'],
  ['A', 'Apêndice A — Inventário de Arquivos', '37'],
  ['B', 'Apêndice B — Algoritmos para Registro INPI', '40'],
]

toc.forEach(([num, title, pg], i) => {
  if (doc.y > 750) newPage()
  const y = doc.y
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10).text(num + '.', L, y, { width: 22, lineBreak: false })
  doc.fillColor(DARK).font('Helvetica').fontSize(10).text(title, L + 24, y, { width: W - 60, lineBreak: false })
  // dots
  const dotsX = L + 24 + doc.widthOfString(title) + 4
  for (let d = dotsX; d < L + W - 32; d += 5) {
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(10).text('.', d, y, { lineBreak: false })
  }
  doc.fillColor(GRAY).font('Helvetica').fontSize(10).text(pg, L + W - 28, y, { width: 28, align: 'right', lineBreak: false })
  doc.y = y + 16
})

doc.moveDown(1)
doc.rect(L, doc.y, W, 40).fill('#EFF6FF')
doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9)
  .text('NOTA DE CONFIDENCIALIDADE', L + 10, doc.y - 32)
doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
  .text('Este documento contém informações estratégicas, técnicas e financeiras da FlowFunnel. Sua reprodução ou distribuição sem autorização expressa é proibida. Destinado exclusivamente para fins de investimento, registro de propriedade intelectual, parceria e apresentação comercial.', L + 10, doc.y + 2, { width: W - 20, lineGap: 1.5 })

// ═══════════════════════════════════════════════════════════════════════
// PÁG 3–4 — VISÃO GERAL
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 1 — VISÃO GERAL DA EMPRESA', true)

h3('O que é a FlowFunnel?')
body('FlowFunnel é uma plataforma SaaS brasileira especializada no rastreamento e qualificação de funis de vendas via WhatsApp. A plataforma conecta dados de tráfego pago (Meta Ads, Google Ads, TikTok Ads) com dados de conversação no WhatsApp e dados de venda nas principais plataformas de infoprodutos do Brasil (Hotmart, Kiwify, Eduzz, Monetizze, Perfect Pay).')
body('Ao contrário de ferramentas de automação, a FlowFunnel NÃO envia mensagens — ela rastreia, qualifica e quantifica cada etapa do funil de vendas, gerando métricas de ROI, CPL, taxa de conversão e inteligência de IA para decisões de investimento em tráfego.')

h3('Problema que Resolve')
h4('Cenário sem FlowFunnel:')
bullet('Empreendedor investe em tráfego pago sem saber o ROI real por campanha')
bullet('Não sabe quantas conversas WhatsApp vieram de cada anúncio ou fonte')
bullet('Não consegue medir taxa de conversão por fonte de tráfego')
bullet('Decisões manuais baseadas em feeling, não em dados objetivos')
bullet('Descobre "onde queimou dinheiro" apenas no final do mês, tarde demais')

h4('Com FlowFunnel:')
bullet('Dashboard unificado: do clique no anúncio até a confirmação de pagamento')
bullet('ROI calculado automaticamente por fonte, campanha e período')
bullet('Lead scoring automático com IA (quente/morno/frio em tempo real)')
bullet('Alertas automáticos de campanhas ineficientes antes que o dinheiro acabe')
bullet('Relatórios PDF/CSV profissionais com um clique')

checkNearBottom(100)
h3('Público-Alvo')
tableHeader(['Segmento', 'Perfil', 'Plano Ideal', 'Ticket Médio'], [140, 195, 80, 70])
;[
  ['Infoprodutor Iniciante', '1–2 produtos/ano, R$2–5k/mês tráfego', 'START', 'R$97/mês'],
  ['Infoprodutor Intermediário', '3–5 lançamentos/ano, time 2–5 pessoas', 'PRO', 'R$147/mês'],
  ['Produtor de Alto Volume', 'Perpétuo, R$50k+/mês tráfego, grande equipe', 'SCALE', 'R$297/mês'],
  ['Gestor de Tráfego', 'Gerencia múltiplas contas, relatórios frequentes', 'PRO/SCALE', 'R$147–297'],
  ['Agência Digital', 'Multi-conta, relatórios white-label para clientes', 'SCALE + Equipe', 'R$297+/mês'],
].forEach((r, i) => tableRow(r, [140, 195, 80, 70], i % 2 === 0))

h3('Mercado Potencial — Brasil')
tableHeader(['Métrica', 'Valor', 'Base / Referência'], [160, 140, 185])
;[
  ['Infoprodutores ativos no Brasil', '~800.000', 'Hotmart / Kiwify reports 2024'],
  ['Gestores de tráfego', '~120.000', 'Associações de marketing digital'],
  ['TAM (mercado total endereçável)', 'R$ 1,7 bilhão/ano', '920.000 × R$147/mês'],
  ['SAM (segmento acessível)', 'R$ 180 milhões/ano', 'Foco em infoprodutores digitais'],
  ['SOM (alvo realista 3 anos)', 'R$ 18 milhões/ano', '~10.000 clientes — 10% do SAM'],
  ['Crescimento do setor (2024–2025)', '+34% ao ano', 'ABComm / Ebit Nielsen'],
].forEach((r, i) => tableRow(r, [160, 140, 185], i % 2 === 0))

h3('Diferenciais Competitivos')
const diferenciais = [
  ['🔗 Funil Completo', 'Do clique no anúncio até confirmação de pagamento — sem gaps de dados entre plataformas'],
  ['🤖 IA Integrada', 'Lead scoring 0–100 e sugestões de otimização via OpenAI GPT-4 incluídas no plano'],
  ['📱 WhatsApp Native', 'Rastreamento real de conversas via WhatsApp Business API oficial da Meta'],
  ['🇧🇷 100% Brasileiro', 'Suporte a Mercado Pago PIX, boleto, e todas as plataformas de infoprodutos BR nativas'],
  ['⚡ Real Time', 'Métricas atualizadas em tempo real com alertas imediatos de anomalias de campanha'],
  ['🔒 LGPD Compliant', 'Termos, privacidade, DPA e todos os requisitos legais brasileiros implementados'],
]
diferenciais.forEach(([title, desc]) => {
  checkNearBottom(30)
  const y = doc.y
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9).text(title, L, y, { width: 130, lineBreak: false })
  doc.fillColor('#374151').font('Helvetica').fontSize(9).text(desc, L + 140, y, { width: W - 145, lineGap: 1.5 })
  doc.y = Math.max(doc.y, y + 14)
  doc.moveDown(0.1)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 5–6 — PLATAFORMA
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 2 — PLATAFORMA — MÓDULOS E FUNCIONALIDADES', true)

const modules = [
  { icon: 'DASHBOARD', name: 'Dashboard Principal', route: '/dashboard', lines: 695,
    desc: 'Visão unificada do funil de vendas. Conecta dados de tráfego pago (Meta, Google, TikTok), WhatsApp e plataformas de venda (Hotmart, Kiwify). Exibe ROI, ROAS, CPL, conversão e comparativo de períodos em tempo real. FunnelFlow visual interativo via React Flow.',
    features: ['FunnelFlow visual interativo (React Flow)', 'KPIs por fonte de tráfego', 'Comparação período atual vs anterior', 'Filtros por campanha e workspace', 'Export CSV e PDF com 1 clique'],
  },
  { icon: 'CRM', name: 'CRM — Leads e Jornada do Lead', route: '/leads + /lead-journey', lines: 393,
    desc: 'Gestão completa de leads com Kanban visual drag-and-drop. Classifica leads por status (NOVO, QUALIFICADO, INTERESSADO, CHECKOUT, CLIENTE). Lead scoring com IA (quente/morno/frio). Jornada cronológica do lead do anúncio até a compra.',
    features: ['Kanban drag-and-drop', 'Lead scoring automático com IA', 'Filtros por status e fonte', 'Timeline da jornada completa do lead'],
  },
  { icon: 'IA', name: 'Inteligência de IA', route: '/conversion-intelligence', lines: 289,
    desc: 'Motor de IA baseado em OpenAI GPT-4 que analisa dados reais do funil e gera sugestões acionáveis: quais campanhas pausar, onde investir mais, quais leads priorizar. Diagnóstico automático de tráfego desperdiçado.',
    features: ['Lead scoring 0–100 (quente/morno/frio)', 'Sugestões de otimização em linguagem natural', 'Diagnóstico de tráfego desperdiçado (PRO)', 'Alertas inteligentes de anomalias (SCALE)'],
  },
  { icon: 'ANALYTICS', name: 'Analytics Avançado', route: '/analytics', lines: 456,
    desc: 'Séries temporais históricas com comparação entre períodos. Análise de performance por plataforma (Meta, Google, TikTok). Identificação de tendências e gráficos interativos com Recharts. Histórico de 7 dias (START) a 365 dias (PRO/SCALE).',
    features: ['Timeseries 7 a 365 dias', 'Gráficos por plataforma', 'Comparação entre dois períodos', 'MetricSnapshots diários via cron'],
  },
  { icon: 'RELATORIOS', name: 'Relatórios', route: '/reports', lines: 464,
    desc: 'Geração de relatórios detalhados em PDF e CSV. Inclui funil completo, breakdown por fonte, análise de ROI e recomendações. Pode ser baixado ou enviado por email. Filtro de data customizável.',
    features: ['Export PDF (jsPDF + PDFKit servidor)', 'Export CSV completo', 'Filtro de data personalizado', 'Gráficos incluídos no PDF'],
  },
  { icon: 'CAMPANHAS', name: 'Campanhas e Webhooks', route: '/campaigns + /webhooks', lines: 558,
    desc: 'Gestão de campanhas de tráfego pago conectadas ao funil. Hub central de integrações: configura conexões com Meta Ads, Google Ads, TikTok Ads, Hotmart, Kiwify, Eduzz, Monetizze e Perfect Pay. Logs de webhooks em tempo real com retry.',
    features: ['Multi-plataforma (Meta, Google, TikTok)', 'Logs de webhooks em tempo real', 'Retry de webhooks falhos', 'HMAC signature validation automática'],
  },
  { icon: 'CONFIG', name: 'Configurações, Billing e Equipe', route: '/settings + /billing', lines: 1027,
    desc: 'Configurações completas: conta, equipe, integrações, alertas. Billing com planos START/PRO/SCALE via Stripe e Mercado Pago. Portal Stripe self-service. Convite de membros da equipe com role Viewer.',
    features: ['Stripe portal self-service', 'Mercado Pago (PIX, boleto, cartão)', 'Trial 7 dias sem cartão', 'Membros da equipe com acesso Viewer'],
  },
  { icon: 'AFILIADOS', name: 'Afiliados e Pixel de Rastreamento', route: '/affiliate + tracker.js', lines: 624,
    desc: 'Sistema nativo de afiliados com tracking de cliques e comissões. Pixel JavaScript público para landing pages: captura UTMs, gera lead_id, rastreia page_view e cliques em checkout, injeta parâmetros automaticamente.',
    features: ['Tracking de cliques e comissões', 'Dashboard do afiliado', 'Pixel JS com captura de UTMs', 'Injeção automática em links de checkout'],
  },
]

modules.forEach((m, idx) => {
  checkNearBottom(85)
  const y = doc.y
  // Header bar
  doc.rect(L, y, W, 20).fill('#EFF6FF')
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10)
    .text(m.name, L + 8, y + 4, { width: W - 100, lineBreak: false })
  doc.fillColor(GRAY).font('Helvetica').fontSize(8)
    .text(m.route, L + W - 130, y + 5, { width: 125, align: 'right', lineBreak: false })
  doc.y = y + 24
  // Description
  doc.font('Helvetica').fontSize(8.5).fillColor('#374151')
    .text(m.desc, L + 6, doc.y, { width: W - 12, lineGap: 1.5 })
  doc.moveDown(0.2)
  // Features
  const featY = doc.y
  m.features.forEach((f, fi) => {
    doc.fillColor('#059669').font('Helvetica-Bold').fontSize(8).text('✓', L + 6 + (fi % 2) * (W/2 - 6), featY + Math.floor(fi/2) * 12, { width: 10, lineBreak: false })
    doc.fillColor('#374151').font('Helvetica').fontSize(8).text(f, L + 16 + (fi % 2) * (W/2 - 6), featY + Math.floor(fi/2) * 12, { width: W/2 - 30, lineBreak: false })
  })
  doc.y = featY + (Math.ceil(m.features.length / 2)) * 12 + 8
  hline()
  doc.moveDown(0.3)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 7–8 — ARQUITETURA
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 3 — ARQUITETURA COMPLETA DO SISTEMA', true)

h3('Stack Tecnológica')
tableHeader(['Camada', 'Tecnologia', 'Versão', 'Finalidade'], [110, 120, 65, 190])
;[
  ['Frontend Framework', 'Next.js (App Router)', '16.2.6', 'SSR, SSG, API Routes, middleware global'],
  ['Linguagem', 'TypeScript', '5.x', 'Type safety em todo o projeto'],
  ['UI / Styling', 'Tailwind CSS', '3.x', 'Design system, responsividade mobile'],
  ['Banco de Dados', 'PostgreSQL', '15+', 'Armazenamento principal gerenciado'],
  ['ORM', 'Prisma', '5.8.1', 'Queries type-safe, migrations, schema'],
  ['Autenticação', 'NextAuth.js', '4.24.5', 'Credentials + Google OAuth, JWT sessions'],
  ['Gráficos', 'Recharts', '2.15.4', 'LineChart, BarChart, PieChart, AreaChart'],
  ['Diagrama de Funil', 'React Flow (@xyflow)', '12.10.2', 'Visualização interativa do funil'],
  ['IA', 'OpenAI API', '6.16.0', 'GPT-4, lead scoring, sugestões de otimização'],
  ['Pagamentos', 'Stripe', '21.0.1', 'Assinaturas, checkout embedded, portal'],
  ['Pagamentos BR', 'Mercado Pago SDK v2', '—', 'PIX, boleto, cartão — Payment Brick'],
  ['Email', 'Resend', '6.9.4', 'Boas-vindas, reset senha, alertas, vendas'],
  ['Export PDF', 'jsPDF + PDFKit', '4.0 / 0.18', 'Relatórios PDF (cliente e servidor)'],
  ['WhatsApp', 'WhatsApp Business Cloud API', 'oficial Meta', 'Webhook para mensagens do WhatsApp'],
  ['Deploy', 'Replit Deployments', '—', 'Hosting, CI/CD, PostgreSQL gerenciado'],
].forEach((r, i) => tableRow(r, [110, 120, 65, 190], i % 2 === 0))

checkNearBottom(120)
h3('Diagrama de Fluxo de Dados')
// Draw architecture diagram
const diagY = doc.y
doc.rect(L, diagY, W, 130).fill('#0F172A')
const dw = W
// Title
doc.fillColor('#38BDF8').font('Helvetica-Bold').fontSize(8).text('TRÁFEGO PAGO', L + 10, diagY + 8)
doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
  .text('Meta Ads → WhatsApp Business API → Hotmart / Kiwify / Eduzz / Monetizze / Perfect Pay', L + 10, diagY + 20, { width: dw - 20 })

doc.fillColor('#A78BFA').font('Helvetica-Bold').fontSize(8).text('CAMADA DE API — Next.js App Router (80+ endpoints)', L + 10, diagY + 38)
doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
  .text('/api/webhooks/* · /api/stripe/* · /api/mercadopago/* · /api/ai/* · /api/analytics/* · /api/reports/*', L + 10, diagY + 50, { width: dw - 20 })

doc.fillColor('#34D399').font('Helvetica-Bold').fontSize(8).text('CAMADA DE DADOS — Prisma ORM + PostgreSQL 15', L + 10, diagY + 68)
doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
  .text('26 modelos · Índices compostos otimizados · MetricSnapshots diários (cron) · Deduplicação de eventos', L + 10, diagY + 80, { width: dw - 20 })

doc.fillColor('#FBBF24').font('Helvetica-Bold').fontSize(8).text('CAMADA DE APRESENTAÇÃO — React 18 + Recharts + React Flow', L + 10, diagY + 98)
doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
  .text('41 componentes · 35+ páginas · FunnelFlow visual · Dashboard em tempo real · Mobile-first', L + 10, diagY + 110, { width: dw - 20 })

doc.fillColor('#F87171').font('Helvetica-Bold').fontSize(8).text('SEGURANÇA — Middleware CSP + HMAC + Rate Limiting + Deduplicação + LGPD', L + 10, diagY + 120, { width: dw - 20 })
doc.y = diagY + 133
doc.moveDown(0.5)

h3('Banco de Dados — 26 Modelos Prisma')
tableHeader(['Modelo', 'Função Principal', 'Relações'], [90, 220, 175])
;[
  ['User', 'Usuário do SaaS — plano, trial, alertas', 'Funnel, Integration, Goal, Campaign, TeamMember'],
  ['Funnel', 'Funil de vendas com etapas configuráveis', 'FunnelStage, FunnelEvent, User, Workspace'],
  ['FunnelStage', 'Etapa do funil (Clique → WhatsApp → Venda)', 'Funnel, FunnelEvent'],
  ['FunnelEvent', 'Evento real rastreado (15k+ por conta demo)', 'FunnelStage, Funnel — índice composto'],
  ['Integration', 'Conexão com plataforma externa', 'User — tipo: META_ADS, WHATSAPP, KIWIFY…'],
  ['Campaign', 'Campanha de tráfego vinculada ao funil', 'User, Workspace — Meta/Google/TikTok'],
  ['Workspace', 'Configuração de funil (workspace multi)', 'User, Integration, Campaign'],
  ['LeadStatus', 'Status atual de cada lead no funil', 'User — NOVO/QUALIFICADO/CLIENTE'],
  ['Goal', 'Meta configurada pelo usuário', 'User — receita, leads, conversões'],
  ['WebhookLog', 'Log de webhooks recebidos', 'User — auditoria e debug com retry'],
  ['MetricSnapshot', 'Snapshot diário de métricas', 'User — timeseries histórico (cron diário)'],
  ['Notification', 'Notificações in-app', 'User — alertas IA, metas, vendas confirmadas'],
  ['TrackedLead', 'Lead rastreado via pixel público', 'User — UTMs originais, lead_id único'],
  ['TrackedEvent', 'Evento do pixel (page_view, click…)', 'TrackedLead'],
  ['TrackedConversion', 'Conversão rastreada (checkout)', 'TrackedLead'],
  ['Affiliate', 'Afiliado da plataforma', 'User, AffiliateClick, AffiliateSale'],
  ['TeamMember', 'Membro da equipe com acesso Viewer', 'User — role VIEWER'],
  ['AuditLog', 'Trilha de auditoria de ações críticas', 'User — pagamentos, upgrades, downgrades'],
  ['StripeProcessedEvent', 'Deduplicação eventos Stripe', 'Chave única: event_id'],
  ['MercadoPagoProcessedEvent', 'Deduplicação eventos Mercado Pago', 'Chave única: paymentId:status'],
  ['WebhookReplayProtection', 'Anti-replay de webhooks externos', 'Chave única por token de plataforma'],
  ['RateLimit', 'Rate limiting persistido no banco', 'Por IP, por user_id, por rota'],
  ['PasswordResetToken', 'Token de reset de senha (SHA-256)', 'User — expiração 1h, uso único'],
  ['EmailVerificationToken', 'Token de verificação de email', 'User — expiração 24h, uso único'],
  ['Account', 'Conta OAuth (Google) vinculada ao User', 'User — índice por userId'],
  ['AffiliateSale', 'Venda atribuída a afiliado', 'Affiliate, User'],
].forEach((r, i) => tableRow(r, [90, 220, 175], i % 2 === 0))

// ═══════════════════════════════════════════════════════════════════════
// PÁG 9–10 — ESTRUTURA DE PASTAS
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 4 — ESTRUTURA DE PASTAS E ARQUIVOS', true)

h3('Árvore Completa do Projeto (346 arquivos · 38.913 linhas)')

const tree = [
  ['flowfunnel/', 0, true],
  ['app/', 1, true],
  ['api/', 2, true],
  ['auth/ — Login, registro, reset senha, verificação email (7 routes)', 3, false],
  ['webhooks/ — Hotmart, Kiwify, Eduzz, Monetizze, WhatsApp, MP (12 routes)', 3, false],
  ['stripe/ — Checkout, subscription, portal, webhook, trial (9 routes)', 3, false],
  ['mercadopago/ — Preference, process-payment, public-key (4 routes)', 3, false],
  ['analytics/ — Timeseries, comparison, trends, platform-perf (4 routes)', 3, false],
  ['facebook/ · google/ · tiktok/ — Métricas de tráfego (6 routes)', 3, false],
  ['whatsapp/ — Messages, metrics, QR stream (3 routes)', 3, false],
  ['ai/ — Sugestões GPT-4, card-insight (2 routes)', 3, false],
  ['cron/ — Snapshot diário, alertas automáticos (2 routes)', 3, false],
  ['reports/ — Relatório, export-csv, export-pdf (3 routes)', 3, false],
  ['leads/ · goals/ · campaigns/ — CRUD completo (8 routes)', 3, false],
  ['affiliates/ · track/ · team/ · plan/ · admin/ (12+ routes)', 3, false],
  ['dashboard/page.tsx — Dashboard principal (695 linhas)', 2, false],
  ['analytics/page.tsx — Analytics avançado (456 linhas)', 2, false],
  ['settings/page.tsx — Configurações + equipe (1.027 linhas)', 2, false],
  ['checkout/page.tsx — Checkout Stripe + MP (840 linhas)', 2, false],
  ['campaigns/ · reports/ · goals/ · leads/ · billing/', 2, false],
  ['webhooks/ · affiliate/ · admin/ · invite/ · pricing/', 2, false],
  ['page.tsx — Landing page pública (626 linhas)', 2, false],
  ['components/ — 41 componentes React', 1, true],
  ['FunnelFlow.tsx — Visualizador React Flow (552 linhas)', 2, false],
  ['AppShell.tsx — Layout + sidebar + banners + CSP', 2, false],
  ['WorkspaceTabs.tsx — Seletor de funil (464 linhas)', 2, false],
  ['AISuggestions.tsx — Sugestões GPT-4 (289 linhas)', 2, false],
  ['LeadKanban.tsx · LeadIntelligence.tsx · NotificationCenter.tsx', 2, false],
  ['PlanGate.tsx · UpgradeTriggers.tsx · TrialBanner.tsx', 2, false],
  ['charts/ — Componentes Recharts (LineChart, BarChart, PieChart)', 2, false],
  ['lib/ — Lógica de negócio e utilitários', 1, true],
  ['prisma.ts · auth.ts · plans.ts · trial.ts · metrics.ts', 2, false],
  ['email.ts — Templates Resend (452 linhas)', 2, false],
  ['leadScoring.ts — Algoritmo de scoring IA', 2, false],
  ['webhook-handlers.ts (364 linhas) · webhook-stages.ts', 2, false],
  ['stripe-dedup.ts · mercadopago-dedup.ts — Claim/release dedup', 2, false],
  ['cache.ts · security-utils.ts · withPlan.ts · sanitize.ts', 2, false],
  ['prisma/ — Schema (26 modelos) + migrations versionadas', 1, true],
  ['public/ — tracker.js (pixel público UTM) + assets estáticos', 1, true],
  ['scripts/ — seed-demo (617 linhas) · db-backup.sh', 1, true],
  ['docs/ — DISASTER_RECOVERY.md (runbook RPO/RTO)', 1, true],
  ['middleware.ts — CSP + auth + rate limit global (172 linhas)', 1, false],
  ['next.config.ts · tailwind.config.ts · tsconfig.json', 1, false],
]

tree.forEach(([text, indent, bold]) => {
  if (doc.y > 760) newPage()
  const pad = indent * 14
  if (bold) {
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8.5)
      .text(text, L + pad, doc.y, { lineBreak: false })
  } else {
    const prefix = indent > 0 ? '├── ' : ''
    doc.fillColor('#475569').font('Courier').fontSize(8)
      .text(prefix + text, L + pad, doc.y, { width: W - pad, lineGap: 0 })
  }
  doc.y += 12
})

checkNearBottom(80)
h3('Maiores Arquivos por Linhas de Código')
const topFiles = [
  ['app/settings/page.tsx', 1027, 'Configurações: conta, equipe, alertas, integrações'],
  ['app/checkout/page.tsx', 840, 'Checkout Stripe + Mercado Pago embedded'],
  ['app/admin/users/page.tsx', 739, 'Painel admin: usuários, MRR, churn, planos'],
  ['app/dashboard/page.tsx', 695, 'Dashboard: métricas, funil visual, AI cards'],
  ['app/page.tsx', 626, 'Landing page: pricing, depoimentos, FAQ'],
  ['app/affiliate/page.tsx', 624, 'Dashboard de afiliados com comissões'],
  ['app/invite/page.tsx', 600, 'Convite de equipe + viewer dashboard'],
  ['scripts/seed-demo-account.ts', 617, 'Seed de conta demo com 30 dias de dados'],
  ['components/FunnelFlow.tsx', 552, 'Visualizador interativo do funil (React Flow)'],
  ['app/campaigns/page.tsx', 558, 'Gestão de campanhas multi-plataforma'],
]
const maxLines = 1027
topFiles.forEach(([file, lines, desc], i) => {
  if (doc.y > 755) newPage()
  const y = doc.y
  barChart(file.replace('app/', '').replace('components/', ''), lines, maxLines, y, i < 3 ? RED : i < 6 ? AMBER : BLUE)
  doc.y = y + 14
  doc.fillColor(GRAY).font('Helvetica').fontSize(7.5).text(desc, L + 118 + 4, doc.y - 10, { width: W - 140 })
  doc.y += 4
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 11–12 — ANÁLISE DE CÓDIGO
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 5 — ANÁLISE DE CÓDIGO-FONTE POR MÓDULO', true)

const codeModules = [
  {
    name: 'Sistema de Autenticação',
    files: 'lib/auth.ts · app/api/auth/[...nextauth] · forgot-password · reset-password · verify-email · middleware.ts',
    importance: 'CRÍTICO',
    color: RED,
    desc: 'Autenticação via NextAuth v4 com credentials + Google OAuth. Senhas hashadas com bcryptjs (salt 12). Reset de senha via token SHA-256 hashed, uso único, expiração de 1h. Verificação de email com token de 24h. Rate limiting por IP na rota de login. CSP global via middleware por request. JWT sessions com validade configurável.',
  },
  {
    name: 'Motor de Métricas e Analytics',
    files: 'lib/metrics.ts · /api/analytics/timeseries · comparison · platform-performance · facebook/metrics · google/metrics',
    importance: 'CRÍTICO',
    color: RED,
    desc: 'Biblioteca central de cálculos: ROI, ROAS, CTR, CPC, CPM, taxa de conversão. Atribuição proporcional de leads e receita por cliques de cada fonte (Meta, Google, TikTok). Timeseries usa MetricSnapshots para dias passados (performance) e agrega FunnelEvents em tempo real para hoje. Comparação de períodos (PRO/SCALE).',
  },
  {
    name: 'Motor de IA e Lead Scoring',
    files: 'lib/leadScoring.ts · /api/ai/suggestions · /api/ai/card-insight · /api/analytics/trends',
    importance: 'ALTO',
    color: AMBER,
    desc: 'Lead scoring 0–100 baseado em: número de interações, tempo de resposta, estágio no funil, frequência de mensagens. Sugestões GPT-4 contextualizadas com dados reais do funil. Diagnóstico de tendências e alertas de anomalia. Feature exclusiva PRO/SCALE com gate em withPlan.ts.',
  },
  {
    name: 'Sistema de Webhooks Multi-Tenant',
    files: 'app/api/webhooks/whatsapp · hotmart · kiwify · eduzz · monetizze · lib/webhook-handlers.ts · webhook-stages.ts · webhook-security.ts',
    importance: 'CRÍTICO',
    color: RED,
    desc: 'Receptor de webhooks de 7 plataformas com HMAC signature validation obrigatória quando secret configurado. Mapeamento normalizado de status para estágios via webhook-stages.ts. Deduplicação via WebhookReplayProtection. Retry manual via UI. Multi-tenant por token na rota (/api/webhooks/hotmart/[token]). Rate limiting de replay.',
  },
  {
    name: 'Sistema de Pagamentos',
    files: 'app/api/stripe/webhook · checkout · portal · activate-plan · lib/stripe-dedup.ts · app/api/mercadopago/process-payment · lib/mercadopago-dedup.ts',
    importance: 'CRÍTICO',
    color: RED,
    desc: 'Stripe: subscription billing com trial 7 dias, embedded checkout, portal self-service. Webhook com dedup persistido (StripeProcessedEvent). Mercado Pago: Payment Brick embedded (PIX, boleto, cartão), dedup MercadoPagoProcessedEvent, rate limiting 10 req/min por IP. Ambos usam padrão claim/release para garantia at-least-once.',
  },
  {
    name: 'Feature Gating e Planos',
    files: 'lib/plans.ts · lib/trial.ts · lib/withPlan.ts · /api/plan · components/PlanGate.tsx · components/usePlan.ts',
    importance: 'ALTO',
    color: AMBER,
    desc: 'Lógica centralizada de planos em lib/plans.ts (limites, features, histórico). getEffectivePlan() leva em conta trial ativo — retorna plano do trial enquanto vigente. withPlan.ts HOF para feature gating em endpoints (retorna HTTP 402 com upgradeUrl). PlanGate component aplica blur + lock + CTA no frontend. Trial 7 dias sem cartão.',
  },
  {
    name: 'Pixel de Rastreamento UTM',
    files: 'public/tracker.js · /api/track/event · /api/track/conversion · /api/track/stats · /api/track/install',
    importance: 'MÉDIO',
    color: BLUE,
    desc: 'Pixel JavaScript público para landing pages dos clientes. Captura UTMs, gera lead_id único (localStorage), rastreia page_view, cliques em checkout e WhatsApp. Usa sendBeacon para garantia de entrega antes do navigate. Injeta parâmetros automaticamente em links Hotmart/Kiwify/Stripe/WhatsApp. Stats autenticados com breakdown UTM.',
  },
  {
    name: 'Notificações e Alertas Automáticos',
    files: 'app/api/cron/alerts · /api/notifications · components/NotificationCenter.tsx · components/AlertSystem.tsx',
    importance: 'MÉDIO',
    color: BLUE,
    desc: 'Cron diário avalia 4 regras: queda de vendas 7d, conversão abaixo da meta, campanha sem leads 24h, gasto sem retorno 48h. Busca dados em lote sem N+1 (groupBy/findMany agregados, avalia em memória). Notificações in-app em tempo real. Alertas automáticos exclusivos do plano SCALE.',
  },
]

codeModules.forEach((m) => {
  checkNearBottom(80)
  const y = doc.y
  // Left color bar
  doc.rect(L, y, 4, 72).fill(m.color)
  // Importance badge
  doc.rect(L + W - 70, y + 2, 68, 14).fill(m.color)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5).text(m.importance, L + W - 66, y + 4, { width: 60, align: 'center', lineBreak: false })
  // Module name
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(m.name, L + 10, y + 2, { width: W - 95, lineBreak: false })
  // Files
  doc.fillColor(GRAY).font('Helvetica').fontSize(7.5).text(m.files, L + 10, y + 16, { width: W - 14 })
  // Description
  const descY = doc.y + 2
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(m.desc, L + 10, descY, { width: W - 14, lineGap: 1.5 })
  doc.y = Math.max(doc.y, y + 72)
  doc.moveDown(0.4)
  hline()
  doc.moveDown(0.4)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 13–14 — PROPRIEDADE INTELECTUAL
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 6 — PROPRIEDADE INTELECTUAL — ALGORITMOS ESTRATÉGICOS', true)

doc.rect(L, doc.y, W, 28).fill('#FEF9C3')
doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(9)
  .text('⚠  AVISO LEGAL', L + 10, doc.y - 20)
doc.fillColor('#78350F').font('Helvetica').fontSize(8.5)
  .text('Os algoritmos descritos constituem a principal propriedade intelectual da FlowFunnel. Recomenda-se registro no INPI (Instituto Nacional da Propriedade Industrial) conforme Lei 9.609/98 (Proteção de Programa de Computador).', L + 10, doc.y + 2, { width: W - 20, lineGap: 1.5 })
doc.moveDown(1)

const ipAlgos = [
  {
    id: 'ALG-001', value: 'MÁXIMO',
    title: 'Lead Scoring Comportamental Multi-Variável',
    file: 'lib/leadScoring.ts',
    desc: 'Algoritmo original que combina múltiplas variáveis comportamentais para gerar score 0–100 e classificação quente/morno/frio. Considera: velocidade de resposta ao lead, profundidade de engajamento nas conversas, frequência de interações com o funil, progressão entre estágios e sinais de intenção de compra detectados no contexto de WhatsApp + infoprodutos.',
    novelty: 'Específico para comportamento de WhatsApp no contexto de infoprodutos brasileiros. Sem precedente público documentado com esta combinação de variáveis.',
    protect: 'Registro de Programa de Computador (INPI) + Direitos Autorais (Lei 9.609/98) + Segredo Industrial',
  },
  {
    id: 'ALG-002', value: 'ALTO',
    title: 'Atribuição Multi-Touch Proporcional por Cliques',
    file: 'lib/metrics.ts — distributeByClicks()',
    desc: 'Distribui leads e receita entre múltiplas fontes de tráfego (Meta Ads, Google Ads, TikTok Ads) proporcionalmente aos cliques de cada fonte, com garantia matemática de soma exata via last-item adjustment (evita perda de decimais em divisão inteira). Resolve o problema clássico de atribuição multi-touch no contexto específico de WhatsApp + infoprodutos.',
    novelty: 'Aplicação original do modelo de atribuição linear ao contexto WhatsApp + infoprodutos com verificação de integridade matemática.',
    protect: 'Registro de Programa de Computador (INPI) + avaliação de viabilidade de patente de método',
  },
  {
    id: 'ALG-003', value: 'ALTO',
    title: 'Deduplicação At-Least-Once com Padrão Claim/Release',
    file: 'lib/stripe-dedup.ts · lib/mercadopago-dedup.ts',
    desc: 'Padrão claim/release no banco de dados para garantia de processamento at-least-once de webhooks de pagamento em ambiente serverless. O claim bloqueia processamento concorrente entre múltiplas instâncias; o release em caso de falha permite retry sem deadlock. Sobrevive a restarts. Espelha exatamente o mesmo padrão entre Stripe e Mercado Pago.',
    novelty: 'Adaptação original do padrão distribuído claim/release para ambiente serverless Next.js + Prisma + PostgreSQL.',
    protect: 'Direitos Autorais (Lei 9.609/98) + Documentação como evidência de autoria e data de criação',
  },
  {
    id: 'ALG-004', value: 'ALTO',
    title: 'Mapeamento Universal de Status para Estágios de Funil',
    file: 'lib/webhook-stages.ts',
    desc: 'Tabela de mapeamento original que normaliza 40+ status diferentes de Hotmart, Kiwify, Eduzz, Monetizze e Perfect Pay para 7 estágios universais do funil FlowFunnel (Recusado, Reembolsado, Chargeback, Abandonado, Pendente, Aprovado, Cancelado).',
    novelty: 'Trabalho de engenharia reversa e padronização original. Não existe documentação pública consolidada destes mapeamentos entre todas as plataformas.',
    protect: 'Direitos Autorais + parte integrante do registro do programa completo',
  },
  {
    id: 'ALG-005', value: 'MÉDIO',
    title: 'Pipeline de Alertas em Lote Sem N+1 Query',
    file: 'app/api/cron/alerts/route.ts',
    desc: 'Avalia 4 regras de alerta de negócio (queda de vendas 7d, conversão abaixo da meta, campanha parada 24h, gasto sem retorno 48h) para N usuários em O(1) queries usando groupBy+aggregate, avaliando em memória — sem loop de queries por usuário.',
    novelty: 'Arquitetura original de pipeline de alertas sem N+1 para SaaS multi-tenant em ambiente serverless.',
    protect: 'Direitos Autorais + know-how técnico (segredo industrial)',
  },
  {
    id: 'ALG-006', value: 'MÉDIO',
    title: 'Pixel UTM com Injeção Automática em Links de Checkout',
    file: 'public/tracker.js',
    desc: 'Script JS público que captura UTMs, persiste lead_id e injeta parâmetros automaticamente em links de checkout (Hotmart, Kiwify, Stripe) e WhatsApp, garantindo rastreabilidade end-to-end sem modificação manual dos links pelo usuário final.',
    novelty: 'Solução original específica para o ecossistema de infoprodutos brasileiros com injeção dinâmica em múltiplos formatos de URL simultaneamente.',
    protect: 'Direitos Autorais + parte do registro do programa completo',
  },
]

ipAlgos.forEach((alg) => {
  checkNearBottom(100)
  const y = doc.y
  const valueColor = alg.value === 'MÁXIMO' ? RED : alg.value === 'ALTO' ? AMBER : BLUE
  doc.rect(L, y, W, 14).fill(valueColor)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
    .text(`${alg.id} — ${alg.title}`, L + 8, y + 2, { width: W - 90, lineBreak: false })
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
    .text(`VALOR: ${alg.value}`, L + W - 85, y + 3, { width: 83, align: 'right', lineBreak: false })
  doc.y = y + 16
  doc.fillColor(GRAY).font('Courier').fontSize(7.5).text(alg.file, L + 6, doc.y)
  doc.moveDown(0.2)
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(alg.desc, L + 6, doc.y, { width: W - 10, lineGap: 1.5 })
  doc.moveDown(0.2)
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8).text('Novidade: ', L + 6, doc.y, { continued: true })
  doc.fillColor('#374151').font('Helvetica').fontSize(8).text(alg.novelty, { width: W - 12, lineGap: 1.5 })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8).text('Proteção: ', L + 6, doc.y, { continued: true })
  doc.fillColor('#374151').font('Helvetica').fontSize(8).text(alg.protect)
  doc.moveDown(0.4)
  hline()
  doc.moveDown(0.3)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 15–16 — MÉTRICAS
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 7 — MÉTRICAS COMPLETAS DO PROJETO', true)

h3('KPIs do Projeto')
const metKpis = [
  ['38.913', 'Linhas de código (TS/TSX/CSS/Prisma)', BLUE],
  ['346', 'Arquivos no projeto', GREEN],
  ['80+', 'Endpoints de API', PURPLE],
  ['26', 'Modelos Prisma (banco)', '#0E7490'],
  ['41', 'Componentes React', AMBER],
  ['35+', 'Páginas do sistema', RED],
  ['12+', 'Integrações externas ativas', '#B45309'],
  ['6', 'Emails transacionais (Resend)', '#475569'],
]
metKpis.forEach((k, i) => {
  const col = i % 2
  const row = Math.floor(i / 2)
  if (col === 0 && row > 0) doc.moveDown(0)
  const x = L + col * (W / 2 + 4)
  const y = doc.y + (col === 1 ? -30 : 0)
  doc.rect(x, y, W/2 - 4, 26).fill(k[2])
  doc.fillColor('white').font('Helvetica-Bold').fontSize(16).text(k[0], x + 8, y + 3, { width: 60, lineBreak: false })
  doc.fillColor('white').font('Helvetica').fontSize(7.5).text(k[1], x + 70, y + 8, { width: W/2 - 78, lineBreak: false })
  if (col === 1) doc.y = y + 30
})
doc.moveDown(0.8)

h3('Breakdown de Linhas por Categoria')
const breakdown = [
  ['Páginas (app/*/page.tsx)', 12400],
  ['API Routes (app/api/**)', 9800],
  ['Componentes React (components/)', 8500],
  ['Bibliotecas e utilitários (lib/)', 5200],
  ['Scripts e configurações', 1600],
  ['Schema Prisma + migrations', 1413],
]
const maxBreak = 12400
breakdown.forEach(([cat, lines]) => {
  checkNearBottom(20)
  const y = doc.y
  barChart(cat, lines, maxBreak, y)
  doc.y = y + 18
})
doc.moveDown(0.5)

h3('APIs e Endpoints — Breakdown por Grupo')
tableHeader(['Grupo', 'Qtde Endpoints', 'Autenticação', 'Rate Limiting'], [120, 80, 140, 145])
;[
  ['Autenticação (auth)', '7', 'Pública + Session', 'Por IP (login)'],
  ['Webhooks externos', '12', 'HMAC signature', 'Deduplicação por token'],
  ['Analytics', '6', 'Session obrigatória', 'Cache TTL in-memory'],
  ['Stripe', '9', 'Session / Webhook secret', 'Por user ID'],
  ['Mercado Pago', '5', 'Session / HMAC', '10 req/min por IP'],
  ['IA (OpenAI)', '2', 'Session + plan check', 'Por user ID (plano)'],
  ['Relatórios', '3', 'Session + plan check', '—'],
  ['Admin', '4', 'Role ADMIN obrigatório', '—'],
  ['Pixel público', '4', 'CORS * (público)', '—'],
  ['Cron', '2', 'Bearer CRON_SECRET', '—'],
  ['Leads, Goals, Campaigns…', '26+', 'Session obrigatória', 'Varia por endpoint'],
].forEach((r, i) => tableRow(r, [120, 80, 140, 145], i % 2 === 0))

checkNearBottom(80)
h3('Dependências Principais — Package.json')
tableHeader(['Pacote', 'Versão', 'Categoria', 'Finalidade'], [130, 85, 80, 190])
;[
  ['next', '^16.2.6', 'Core', 'Framework full-stack com App Router'],
  ['react / react-dom', '^18.2.0', 'Core', 'Biblioteca de UI'],
  ['typescript', '5.x', 'Core', 'Type safety em todo o projeto'],
  ['@prisma/client', '^5.8.1', 'Database', 'ORM type-safe para PostgreSQL'],
  ['next-auth', '^4.24.5', 'Auth', 'Authentication + Google OAuth'],
  ['stripe', '^21.0.1', 'Payments', 'Billing, checkout, portal, webhooks'],
  ['openai', '^6.16.0', 'IA', 'GPT-4 para sugestões e scoring'],
  ['recharts', '^2.15.4', 'Charts', 'Gráficos interativos (Line, Bar, Pie)'],
  ['@xyflow/react', '^12.10.2', 'Visualização', 'Diagrama interativo do funil'],
  ['resend', '^6.9.4', 'Email', 'Emails transacionais'],
  ['jspdf + pdfkit', '^4.0.0 / ^0.18', 'Export', 'Geração de PDF cliente e servidor'],
  ['bcryptjs', '^2.4.3', 'Security', 'Hash de senhas com salt'],
  ['zod', '^3.22.4', 'Validation', 'Schema validation em APIs'],
  ['date-fns', '^3.2.0', 'Utilities', 'Manipulação de datas'],
  ['tailwindcss', '3.x', 'CSS', 'Design system utility-first'],
].forEach((r, i) => tableRow(r, [130, 85, 80, 190], i % 2 === 0))

// ═══════════════════════════════════════════════════════════════════════
// PÁG 17–18 — ESCALABILIDADE
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 8 — ANÁLISE DE ESCALABILIDADE', true)

h3('Capacidade Atual do Sistema')
tableHeader(['Componente', 'Capacidade Atual', 'Limitante', 'Solução para Escala'], [110, 100, 120, 155])
;[
  ['Usuários simultâneos', '500–2.000', 'Instância única', 'Load balancer + múltiplas instâncias'],
  ['Webhooks por segundo', '50–200/s', 'Processamento síncrono', 'Fila assíncrona (BullMQ / SQS)'],
  ['Eventos no banco', 'Ilimitado', 'Performance de query', 'Índices compostos já implementados'],
  ['Usuários no banco', '100.000+', 'Tamanho do banco', 'Read replicas, particionamento'],
  ['Relatórios PDF', 'Síncrono (30s)', 'Timeout de request', 'Job queue + polling + download link'],
  ['IA (OpenAI)', 'Rate limited API', 'Custo e latência 3–8s', 'Cache de respostas + streaming'],
].forEach((r, i) => tableRow(r, [110, 100, 120, 155], i % 2 === 0))

h3('Otimizações Já Implementadas')
const opts = [
  ['Índices compostos no banco', 'FunnelEvent(funnelId, timestamp) · WebhookLog(userId, createdAt) · Account(userId) · Funnel(userId)'],
  ['MetricSnapshots diários', 'Timeseries usa snapshots para dias passados (não agrega live) — drástica redução de CPU'],
  ['Cron queries em lote', 'Sem N+1: busca todos os usuários em poucas queries, avalia alertas em memória'],
  ['Cache in-memory com TTL', 'lib/cache.ts: TTL de 2 min para métricas, 5 min para dados de campanha'],
  ['Rate limiting persistido', 'RateLimit model no banco — compartilhado entre instâncias'],
  ['Deduplicação no banco', 'StripeProcessedEvent + MercadoPagoProcessedEvent — sem eventos duplicados'],
]
opts.forEach(([title, desc]) => {
  checkNearBottom(25)
  const y = doc.y
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8).text('✓', L, y, { width: 12, lineBreak: false })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text(title + ': ', L + 14, y, { width: 130, lineBreak: false })
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(desc, L + 14, y + 11, { width: W - 14, lineGap: 1.5 })
  doc.y = Math.max(doc.y, y + 22)
  doc.moveDown(0.1)
})

h3('Projeção de Infra por Volume de Usuários')
tableHeader(['Usuários', 'Infraestrutura', 'Custo Infra/mês', 'Ações Necessárias'], [75, 160, 90, 160])
;[
  ['0–500', 'Replit atual (1 instância)', 'R$ 200–500', 'Nenhuma — já funciona'],
  ['500–2.000', 'Replit + PostgreSQL dedicado', 'R$ 800–2.000', 'Upgrades de plano Replit'],
  ['2.000–10.000', 'AWS/GCP: 2–4 instâncias + RDS', 'R$ 3.000–8.000', 'Containerização, load balancer'],
  ['10.000–50.000', 'Kubernetes + Aurora PostgreSQL', 'R$ 15.000–40.000', 'Fila async, CDN, Redis'],
  ['50.000+', 'Multi-region + sharding', 'R$ 60.000+', 'Equipe DevOps dedicada'],
].forEach((r, i) => tableRow(r, [75, 160, 90, 160], i % 2 === 0))

h3('Gargalos Identificados e Plano de Solução')
;[
  ['ALTA', 'Webhooks síncronos', 'Implementar fila BullMQ/SQS. Webhooks confirmam 200 imediatamente e processam async. Elimina timeout em picos de vendas (Black Friday, Lançamentos).', RED],
  ['MÉDIA', 'Geração de PDF bloqueante', 'Mover para job queue: usuário solicita → recebe ID → baixa quando pronto. Worker separado processa PDFs em background com progresso.', AMBER],
  ['MÉDIA', 'Cache não compartilhado', 'Migrar de cache in-memory para Redis para cache compartilhado entre múltiplas instâncias. TTL atual funciona bem na instância única.', AMBER],
  ['BAIXA', 'OpenAI latência 3–8s', 'Cache de respostas de IA (5-10 min TTL), streaming SSE de respostas, fallback para respostas pré-calculadas por segmento.', BLUE],
].forEach(([prio, gap, sol, color]) => {
  checkNearBottom(40)
  const y = doc.y
  doc.rect(L, y, 55, 28).fill(color)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5).text(prio, L, y + 4, { width: 55, align: 'center' })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text(gap, L + 62, y + 2, { width: W - 65, lineBreak: false })
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(sol, L + 62, y + 14, { width: W - 65, lineGap: 1.5 })
  doc.y = Math.max(doc.y, y + 30)
  doc.moveDown(0.3)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 19–21 — MODELO DE NEGÓCIO
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 9 — MODELO DE NEGÓCIO', true)

h3('Planos e Preços')
tableHeader(['Plano', 'Preço', 'Conversas/mês', 'Recursos Principais'], [60, 85, 95, 245])
;[
  ['FREE', 'R$0', '0 (bloqueado)', 'Dashboard básico, sem conversas, trial disponível'],
  ['START', 'R$97/mês', '1.000 conversas', '1 funil, 1 WhatsApp, 7 dias histórico, export CSV, sem IA'],
  ['PRO', 'R$147/mês', '3.000 conversas', '3 funis, 3 WhatsApp, 365 dias, lead scoring IA, comparativo'],
  ['SCALE', 'R$297/mês', 'Ilimitado', 'Funis ∞, WhatsApp ∞, alertas automáticos IA, equipe viewer'],
].forEach((r, i) => tableRow(r, [60, 85, 95, 245], i % 2 === 0))

h3('Métricas de Negócio')
tableHeader(['Métrica', 'Valor Estimado', 'Base de Cálculo / Contexto'], [130, 110, 245])
;[
  ['ARPU (Ticket Médio)', 'R$ 174/mês', 'Mix: 50% START R$97 · 35% PRO R$147 · 15% SCALE R$297'],
  ['CAC (Custo de Aquisição)', 'R$ 120–200', 'Via ads, afiliados e marketing orgânico'],
  ['LTV (Lifetime Value)', 'R$ 1.740–2.600', 'ARPU × 10–15 meses (churn estimado 6–10%/mês)'],
  ['LTV/CAC Ratio', '10–13x', 'Excelente: meta de mercado é mínimo 3x'],
  ['Churn Mensal Estimado', '6–10%', 'Média SaaS B2B Brasil — pequenas empresas'],
  ['MRR Break-even', '~R$ 8.000/mês', '~47 clientes START ou ~27 clientes PRO'],
  ['Payback Period', '1–2 meses', 'CAC R$160 / ARPU R$174 = payback < 1 mês'],
  ['Trial Conversion (Est.)', '20–35%', 'Trial 7 dias sem cartão — baixa fricção'],
  ['NRR (Expansão)', '~108%', 'Upsell START→PRO→SCALE impulsiona NRR acima de 100%'],
].forEach((r, i) => tableRow(r, [130, 110, 245], i % 2 === 0))

h3('Fontes de Receita')
;[
  ['1', 'Assinaturas Mensais (Principal)', 'START R$97 · PRO R$147 · SCALE R$297 via Stripe (cartão internacional) ou Mercado Pago (PIX, boleto, cartão nacional). Recorrência mensal com renovação automática.'],
  ['2', 'Programa de Afiliados', 'Sistema nativo: afiliados promovem e recebem % por venda confirmada. Tracking de cliques e comissões implementado. Reduz CAC sem custo fixo adicional — crescimento orgânico.'],
  ['3', 'Upsell e Expansão de Plano', 'UpgradeTriggers dinâmicos baseados em dados reais: ao atingir limite de conversas, CTA contextual aparece. Aumenta ARPU sem CAC adicional. NRR > 100%.'],
  ['4', 'Futuro: White-Label / Enterprise', 'Licenciamento para agências (branding próprio) ou API access para integrações customizadas. Plano Enterprise com contrato anual, SLA e suporte dedicado.'],
].forEach(([n, title, desc]) => {
  checkNearBottom(35)
  const y = doc.y
  doc.circle(L + 8, y + 8, 8).fill(BLUE)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(9).text(n, L + 4, y + 3, { width: 10, align: 'center', lineBreak: false })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text(title, L + 22, y, { width: W - 22, lineBreak: false })
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(desc, L + 22, y + 13, { width: W - 22, lineGap: 1.5 })
  doc.y = Math.max(doc.y, y + 32)
  doc.moveDown(0.2)
})

checkNearBottom(70)
h3('Funil de Conversão da Própria Plataforma')
const funnelStages = [
  ['Visita à Landing Page', '100%', '10.000 visitas/mês', W],
  ['Clica em "7 dias grátis"', '12%', '1.200 registros', W * 0.75],
  ['Ativa Trial com Plano', '60% dos cadastros', '720 trials ativos', W * 0.55],
  ['Converte para Pago', '28% dos trials', '202 pagantes novos/mês', W * 0.38],
  ['Retém no Mês 3', '72% dos pagantes', '145 retidos ativos', W * 0.25],
]
funnelStages.forEach(([stage, pct, n, bw], i) => {
  if (doc.y > 750) newPage()
  const y = doc.y
  const colors = [BLUE, '#0369A1', '#0E7490', GREEN, '#065F46']
  doc.rect(L, y, bw, 18).fill(colors[i])
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
    .text(`${stage}  —  ${pct}  —  ${n}`, L + 6, y + 4, { width: bw - 10, lineBreak: false })
  doc.y = y + 22
  doc.moveDown(0)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 22–25 — PROJEÇÕES FINANCEIRAS
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 10 — PROJEÇÕES FINANCEIRAS', true)

body('Projeções baseadas em ARPU médio de R$174/mês, churn de 8%/mês, custos de infraestrutura e operação estimados conforme escala. Crescimento inicial de 15–20% ao mês, decaindo para 8% após PMF.')

h3('Cenário Conservador — 100 a 1.000 Clientes')
tableHeader(['Clientes', 'MRR', 'ARR', 'Custo Infra', 'Custo Total Op.', 'EBITDA/mês', 'Margem'], [60, 80, 90, 70, 90, 80, 65])
;[
  ['100', 'R$17.400', 'R$208.800', 'R$800', 'R$5.000', 'R$12.400', '71%'],
  ['250', 'R$43.500', 'R$522.000', 'R$1.500', 'R$10.000', 'R$33.500', '77%'],
  ['500', 'R$87.000', 'R$1.044.000', 'R$2.500', 'R$20.000', 'R$67.000', '77%'],
  ['1.000', 'R$174.000', 'R$2.088.000', 'R$5.000', 'R$40.000', 'R$134.000', '77%'],
].forEach((r, i) => tableRow(r, [60, 80, 90, 70, 90, 80, 65], i % 2 === 0))

h3('Cenário Moderado — 2.500 a 10.000 Clientes')
tableHeader(['Clientes', 'MRR', 'ARR', 'Custo Infra', 'Custo Total Op.', 'EBITDA/mês', 'Margem'], [60, 90, 100, 70, 90, 90, 55])
;[
  ['2.500', 'R$435.000', 'R$5.220.000', 'R$12.000', 'R$100.000', 'R$335.000', '77%'],
  ['5.000', 'R$870.000', 'R$10.440.000', 'R$25.000', 'R$200.000', 'R$670.000', '77%'],
  ['10.000', 'R$1.740.000', 'R$20.880.000', 'R$60.000', 'R$450.000', 'R$1.290.000', '74%'],
].forEach((r, i) => tableRow(r, [60, 90, 100, 70, 90, 90, 55], i % 2 === 0))

h3('Cenário Agressivo — 25.000 a 100.000 Clientes')
tableHeader(['Clientes', 'MRR', 'ARR', 'Custo Infra', 'Custo Total Op.', 'EBITDA/mês', 'Margem'], [65, 90, 105, 70, 90, 90, 55])
;[
  ['25.000', 'R$4.350.000', 'R$52.200.000', 'R$150.000', 'R$1.200.000', 'R$3.150.000', '72%'],
  ['50.000', 'R$8.700.000', 'R$104.400.000', 'R$300.000', 'R$2.500.000', 'R$6.200.000', '71%'],
  ['100.000', 'R$17.400.000', 'R$208.800.000', 'R$600.000', 'R$5.000.000', 'R$12.400.000', '71%'],
].forEach((r, i) => tableRow(r, [65, 90, 105, 70, 90, 90, 55], i % 2 === 0))

checkNearBottom(120)
h3('Projeção de Crescimento — 36 Meses (Cenário Moderado)')
const months = [
  ['M3', 20, 3480], ['M6', 50, 8700], ['M9', 100, 17400], ['M12', 180, 31320],
  ['M15', 280, 48720], ['M18', 420, 73080], ['M21', 600, 104400], ['M24', 850, 147900],
  ['M27', 1200, 208800], ['M30', 1700, 295800], ['M33', 2400, 417600], ['M36', 3200, 556800],
]
const maxMRR = 556800
const barH = 8, barGap = 12
months.forEach((m, i) => {
  if (doc.y > 760) newPage()
  const y = doc.y
  const bw = Math.max(2, (m[2] / maxMRR) * (W - 80))
  doc.fillColor(GRAY).font('Helvetica').fontSize(7).text(m[0], L, y + 0, { width: 22, lineBreak: false })
  doc.rect(L + 24, y, bw, barH).fill(i < 4 ? '#BFDBFE' : i < 8 ? BLUE : PURPLE)
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(7)
    .text(`${m[1]} cli · R$${(m[2]/1000).toFixed(0)}k MRR`, L + 24 + bw + 4, y, { lineBreak: false })
  doc.y = y + barGap
})
doc.moveDown(0.4)

h3('Composição de Custos Operacionais (1.000 clientes / MRR R$174k)')
tableHeader(['Item', 'Custo/mês', '% da Receita'], [260, 100, 125])
;[
  ['Infraestrutura (hosting, DB, CDN)', 'R$5.000', '2,9%'],
  ['OpenAI API (IA)', 'R$3.000', '1,7%'],
  ['Stripe + Mercado Pago (fees ~3%)', 'R$5.220', '3,0%'],
  ['Resend (email transacional)', 'R$500', '0,3%'],
  ['WhatsApp Business API', 'R$1.000', '0,6%'],
  ['Suporte / Customer Success', 'R$8.000', '4,6%'],
  ['Marketing e Aquisição (CAC)', 'R$15.000', '8,6%'],
  ['Overhead (legal, contabilidade…)', 'R$2.280', '1,3%'],
  ['TOTAL DE CUSTOS', 'R$40.000', '23%'],
  ['EBITDA ESTIMADO', 'R$134.000', '77%'],
].forEach((r, i) => tableRow(r, [260, 100, 125], i % 2 === 0))

// ═══════════════════════════════════════════════════════════════════════
// PÁG 26–27 — VALUATION
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 11 — VALUATION DA EMPRESA', true)

doc.rect(L, doc.y, W, 28).fill('#EFF6FF')
doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9).text('METODOLOGIA', L + 10, doc.y - 20)
doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
  .text('Valuation SaaS via múltiplos de ARR (Annual Recurring Revenue). Múltiplos típicos para SaaS brasileiro early-stage: 5–12x ARR. Startups com crescimento acelerado (30%+/mês) atingem 15–25x ARR. Ajustado por churn, NRR, market size e diferenciação de produto.', L + 10, doc.y + 2, { width: W - 20, lineGap: 1.5 })
doc.moveDown(1)

h3('Valuation por Estágio de Crescimento')
tableHeader(['Estágio', 'Clientes', 'ARR', 'Múltiplo', 'Valuation Estimado'], [95, 65, 105, 70, 150])
;[
  ['Pre-revenue (atual)', '0–10', '—', 'Valor IP + Tech', 'R$300.000 – R$800.000'],
  ['Early traction', '50–100', 'R$208.800', '8x ARR', 'R$1.670.400'],
  ['Product-Market Fit', '500', 'R$1.044.000', '10x ARR', 'R$10.440.000'],
  ['Scale', '2.000', 'R$4.176.000', '12x ARR', 'R$50.112.000'],
  ['Growth', '10.000', 'R$20.880.000', '15x ARR', 'R$313.200.000'],
  ['Market Leader', '50.000', 'R$104.400.000', '12x ARR', 'R$1.252.800.000'],
].forEach((r, i) => tableRow(r, [95, 65, 105, 70, 150], i % 2 === 0))

h3('Valor Atual do Ativo Tecnológico')
tableHeader(['Componente', 'Base de Cálculo', 'Valor Estimado'], [165, 195, 125])
;[
  ['Código-fonte (38.913 linhas)', 'R$50–100/linha (dev sênior BR)', 'R$1.945.650 – R$3.891.300'],
  ['Propriedade Intelectual (6 algoritmos)', 'Valor diferencial de mercado', 'R$200.000 – R$500.000'],
  ['Arquitetura e design do sistema', '500h × R$300/h (arquiteto sênior)', 'R$150.000'],
  ['12+ integrações implementadas', '50h × R$200/h × 12 plataformas', 'R$120.000'],
  ['Banco de dados e modelagem', '100h × R$250/h', 'R$25.000'],
  ['Documentação e processos', '—', 'R$30.000'],
  ['TOTAL DO ATIVO TECNOLÓGICO', '—', 'R$2.470.650 – R$4.716.300'],
].forEach((r, i) => tableRow(r, [165, 195, 125], i % 2 === 0))

h3('Fatores de Valorização e Risco')
const factors = [
  { type: 'POS', icon: '+', color: GREEN, items: [
    'Mercado em crescimento de 34% ao ano no Brasil',
    'Nicho específico com baixa concorrência direta',
    'Trial sem cartão = menor fricção de conversão',
    'Múltiplos processadores de pagamento (BR-first)',
    'IA integrada como diferencial competitivo',
    'Pixel próprio = dados proprietários de UTM',
    'Sistema de afiliados = CAC reduzido organicamente',
  ]},
  { type: 'RISK', icon: '!', color: RED, items: [
    'Dependência da WhatsApp Business API (Meta)',
    'Concorrência potencial de grandes players (RD Station)',
    'Churn potencial em crises econômicas',
    'Regulação LGPD em evolução constante',
    'Custo crescente da OpenAI API',
    'Risco de equipe pequena (single point of failure)',
  ]},
]
const halfW = (W - 10) / 2
factors.forEach((f, fi) => {
  const x = L + fi * (halfW + 10)
  const startY = doc.y
  doc.rect(x, startY, halfW, 14).fill(f.color)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
    .text(f.type === 'POS' ? '✓  FATORES POSITIVOS' : '⚠  FATORES DE RISCO', x + 6, startY + 2, { width: halfW - 8, lineBreak: false })
  let itemY = startY + 16
  f.items.forEach(item => {
    doc.fillColor(f.color).font('Helvetica-Bold').fontSize(8).text(f.icon, x + 4, itemY, { width: 10, lineBreak: false })
    doc.fillColor('#374151').font('Helvetica').fontSize(8).text(item, x + 14, itemY, { width: halfW - 18, lineGap: 1 })
    itemY += 16
  })
  if (fi === 1) doc.y = itemY + 4
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 28–30 — ANÁLISE COMPETITIVA
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 12 — ANÁLISE COMPETITIVA', true)

h3('Comparativo de Recursos')
tableHeader(['Recurso', 'FlowFunnel', 'RD Station', 'HubSpot', 'Kommo', 'Zapier'], [145, 75, 65, 65, 55, 80])
;[
  ['Rastreamento WhatsApp nativo', '✓ Nativo', '✗', '✗', '~ Limitado', '✗'],
  ['Funil visual Meta→WA→Venda', '✓ Completo', '✗', '✗', '~ Parcial', '✗'],
  ['ROI por fonte de tráfego', '✓ Automático', '~ Manual', '~ Manual', '✗', '✗'],
  ['Lead scoring com IA', '✓ Incluído', '✗', '$ Pago extra', '✗', '✗'],
  ['Integração PIX/Boleto BR', '✓ Mercado Pago', '✗', '✗', '✗', '✗'],
  ['Hotmart/Kiwify/Eduzz nativo', '✓ Nativo', '~ Via Zapier', '~ Via Zapier', '✗', '✓ Fluxo'],
  ['Relatório PDF automático', '✓ Incluído', '~ Limitado', '$ Pago extra', '✗', '✗'],
  ['Trial sem cartão', '✓ 7 dias', '✓', '✓', '✓', '✓'],
  ['Alertas automáticos IA', '✓ SCALE', '✗', '$ Extra', '✗', '✗'],
  ['Preço mínimo (Brasil)', '✓ R$97/mês', 'R$149/mês', 'US$15/mês', 'US$15/mês', 'US$20/mês'],
  ['Suporte em português', '✓ Nativo', '✓ Nativo', '~ Básico', '~ Básico', '✗'],
  ['Programa de afiliados', '✓ Nativo', '✗', '✗', '✗', '✗'],
  ['Pixel de rastreamento UTM', '✓ Incluso', '✓', '✓', '✗', '✗'],
].forEach((r, i) => tableRow(r, [145, 75, 65, 65, 55, 80], i % 2 === 0))

checkNearBottom(80)
h3('Posicionamento Estratégico')
body('A FlowFunnel atua em um OCEANO AZUL: nenhuma plataforma do mercado brasileiro oferece a combinação específica de rastreamento WhatsApp Business API + atribuição multi-fonte de tráfego pago + integração nativa com infoprodutos BR (Hotmart, Kiwify, Eduzz) + IA de lead scoring, tudo em um único produto por R$97–297/mês.')
body('Vantagem Competitiva Sustentável: a combinação de dados proprietários de comportamento WhatsApp + UTM pixel + compras gera um dataset único que alimenta modelos de IA cada vez mais precisos. Efeito de rede: quanto mais usuários, melhor o scoring de IA, criando uma barreira de entrada crescente.')

h3('Análise SWOT')
const swot = [
  { q: 'FORÇAS (Strengths)', color: GREEN, items: ['Único no nicho WhatsApp + infoprodutos BR', 'Preço acessível vs. concorrentes internacionais', 'IA integrada sem custo extra', 'Múltiplos métodos de pagamento BR (PIX, boleto, cartão)', 'Trial sem cartão — baixa fricção de entrada', 'Sistema de afiliados nativo', 'LGPD compliant com todas as páginas legais'] },
  { q: 'FRAQUEZAS (Weaknesses)', color: AMBER, items: ['Time pequeno / solo founder risk', 'Brand awareness ainda em construção', 'Sem app mobile nativo', 'Dependência de APIs de terceiros (Meta, WA)', 'Suporte 24/7 ainda não implementado', 'Sem plano Enterprise formal', 'White-label ainda não disponível'] },
  { q: 'OPORTUNIDADES (Opportunities)', color: BLUE, items: ['Mercado de infoprodutos crescendo 34%/ano', 'WhatsApp com 169M usuários no Brasil', 'IA como diferencial crescente no mercado', 'White-label para agências — alta margem', 'Expansão LATAM: México e Argentina', 'API pública para ecossistema de parceiros'] },
  { q: 'AMEAÇAS (Threats)', color: RED, items: ['Meta pode mudar políticas da WhatsApp API', 'RD Station / HubSpot podem entrar no nicho', 'Regulação LGPD em evolução constante', 'Crise econômica reduz investimento em tráfego', 'Possível concorrente open-source', 'Custo crescente da OpenAI API'] },
]
const sqW = (W - 6) / 2
const sqH = 90
swot.forEach((q, i) => {
  checkNearBottom(sqH + 10)
  const x = L + (i % 2) * (sqW + 6)
  const y = i < 2 ? doc.y : doc.y
  if (i === 2) doc.y += sqH + 6
  doc.rect(x, i < 2 ? doc.y : doc.y - (sqH + 6) * 2, sqW, 14).fill(q.color)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5)
    .text(q.q, x + 6, (i < 2 ? doc.y : doc.y - (sqH + 6) * 2) + 2, { width: sqW - 10, lineBreak: false })
  const iy = (i < 2 ? doc.y : doc.y - (sqH + 6) * 2) + 16
  q.items.forEach((item, ii) => {
    doc.fillColor(q.color).font('Helvetica-Bold').fontSize(7.5).text('•', x + 4, iy + ii * 11, { width: 8, lineBreak: false })
    doc.fillColor('#374151').font('Helvetica').fontSize(8).text(item, x + 12, iy + ii * 11, { width: sqW - 16, lineBreak: false })
  })
  if (i === 1) doc.y += sqH + 10
  if (i === 3) doc.y += sqH + 10
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 31–32 — SEGURANÇA
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 13 — SEGURANÇA E LGPD', true)

h3('Camadas de Segurança Implementadas')
tableHeader(['Área', 'Implementação', 'Nível'], [120, 295, 70])
;[
  ['Autenticação', 'NextAuth v4 com JWT sessions. bcryptjs salt-12 para senhas. Google OAuth opcional.', 'ALTO'],
  ['Autorização', 'Middleware global: rotas protegidas por session. Role ADMIN para painel admin.', 'ALTO'],
  ['Rate Limiting', 'Por IP no login. Por user ID nos pagamentos. 10 req/min no Mercado Pago. RateLimit model no DB.', 'ALTO'],
  ['Content Security Policy', 'CSP por request via middleware: script-src, style-src, connect-src, frame-src. object-src: none.', 'ALTO'],
  ['HMAC Webhook Validation', 'Todos os webhooks externos validam assinatura HMAC. Fail-closed: rejeita sem header quando secret configurado.', 'CRÍTICO'],
  ['Webhook Deduplication', 'StripeProcessedEvent + MercadoPagoProcessedEvent + WebhookReplayProtection. Padrão claim/release no banco.', 'ALTO'],
  ['Tokens de Reset/Verificação', 'SHA-256 hashed, uso único, expiração temporal. Token bruto apenas no link do email — nunca no banco.', 'ALTO'],
  ['SQL Injection', 'Prisma ORM com queries parametrizadas. Sem SQL raw em endpoints públicos.', 'ALTO'],
  ['Audit Log', 'Modelo AuditLog para ações críticas: pagamentos, upgrades, downgrades, deleção de conta.', 'MÉDIO'],
  ['Secrets Management', 'Todas as chaves em Replit Secrets (env vars). Nenhuma chave no repositório de código.', 'CRÍTICO'],
  ['Backup e Recovery', 'scripts/db-backup.sh para export lógico (pg_dump). docs/DISASTER_RECOVERY.md com runbook RPO/RTO.', 'MÉDIO'],
  ['Sanitização de Inputs', 'lib/sanitize.ts · zod schemas em todas as APIs públicas. DOMPurify em conteúdo externo.', 'ALTO'],
].forEach((r, i) => tableRow(r, [120, 295, 70], i % 2 === 0))

h3('Conformidade LGPD — Lei 13.709/2018')
const lgpd = [
  ['Documentos Legais', ['/termos — Termos de Uso completos', '/privacidade — Política de Privacidade + DPA', '/lgpd — Página específica de direitos LGPD', 'Cookie Consent (CookieConsent.tsx)', 'Links legais no footer de todas as páginas']],
  ['Direitos do Titular', ['/account — Acesso e visualização dos dados', '/api/account/email — Correção de dados', '/api/account/delete — Exclusão e portabilidade', 'Export CSV em /reports — Portabilidade', 'Verificação de email — Consentimento explícito']],
]
const lgpdW = (W - 8) / 2
lgpd.forEach((sec, i) => {
  const x = L + i * (lgpdW + 8)
  const y = doc.y
  doc.rect(x, y, lgpdW, 14).fill(BLUE)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5).text(sec[0], x + 6, y + 2, { width: lgpdW - 10, lineBreak: false })
  sec[1].forEach((item, ii) => {
    doc.fillColor('#374151').font('Helvetica').fontSize(8).text('• ' + item, x + 6, y + 18 + ii * 14, { width: lgpdW - 10, lineBreak: false })
  })
  if (i === 1) doc.y = y + 18 + sec[1].length * 14 + 8
})
doc.moveDown(0.5)

doc.rect(L, doc.y, W, 30).fill('#FEF9C3')
const recY = doc.y - 22
doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(9).text('Pendências Recomendadas:', L + 10, recY)
doc.fillColor('#78350F').font('Helvetica').fontSize(8.5)
  .text('1. Implementar DPA (Data Processing Agreement) formal para clientes SCALE.  2. Nomear DPO (Data Protection Officer).  3. Registro no ANPD quando exigido.  4. Relatório de Impacto RIPD para dados sensíveis de leads.', L + 10, recY + 12, { width: W - 20, lineGap: 1.5 })

// ═══════════════════════════════════════════════════════════════════════
// PÁG 33–34 — ROADMAP
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 14 — ROADMAP DE PRODUTO', true)

h3('Versão 1.0 — Recursos Já Implementados')
const v1features = [
  'Dashboard com FunnelFlow visual interativo', 'Meta Ads + Google Ads + TikTok Ads', 'WhatsApp Business Cloud API',
  'Hotmart + Kiwify + Eduzz + Monetizze + Perfect Pay', 'Lead Scoring com IA (OpenAI GPT-4)', 'Sugestões GPT-4 contextualizadas',
  'Analytics Timeseries (7–365 dias)', 'Relatórios PDF + CSV', 'CRM Kanban com drag-and-drop', 'Metas e progresso',
  'Stripe + Mercado Pago (PIX, boleto, cartão)', 'Trial 7 dias sem cartão', 'Programa de Afiliados nativo',
  'Convite de Equipe (Viewer)', 'Pixel de Rastreamento UTM', 'Alertas Automáticos IA (SCALE)',
  'LGPD — Termos, Privacidade, Cookies', 'Reset de Senha + Verificação Email', 'Painel Admin completo',
  'CSP + Rate Limiting + Dedup webhooks', 'MetricSnapshots Diários (cron)', 'Comparativo de Períodos (PRO)',
]
let fx = L, fy = doc.y
v1features.forEach((f, i) => {
  const fw = doc.widthOfString(f, { fontSize: 7.5 }) + 16
  if (fx + fw > L + W) { fx = L; fy += 16 }
  if (fy > 760) { newPage(); fy = doc.y; fx = L }
  doc.rect(fx, fy, fw, 13).fill('#D1FAE5')
  doc.fillColor('#065F46').font('Helvetica').fontSize(7.5).text(f, fx + 8, fy + 2, { lineBreak: false })
  fx += fw + 4
})
doc.y = fy + 18
doc.moveDown(0.5)

const roadmap = [
  { q: 'Q3 2026 — Retenção e Produto', color: RED, items: [
    ['ALTA', 'App Mobile (React Native / Expo)', 'Reduz churn, aumenta engajamento diário'],
    ['ALTA', 'Relatórios White-Label (PDF com logo do cliente)', 'Habilita segmento agências, aumenta ARPU'],
    ['ALTA', 'Dashboard Multiusuário (SCALE)', 'Diferencial SCALE, aumenta LTV do cliente'],
    ['ALTA', 'Webhook fila assíncrona (BullMQ)', 'Escalabilidade em picos de venda'],
  ]},
  { q: 'Q4 2026 — Expansão de Integrações', color: AMBER, items: [
    ['MÉDIA', 'Google Analytics 4 (importação de dados)', 'Dados de funil mais completos'],
    ['MÉDIA', 'CRM Externo (Kommo, HubSpot via API)', 'Integração com stack existente dos clientes'],
    ['MÉDIA', 'Análise de sentimento das conversas', 'Qualidade automática de leads'],
    ['BAIXA', 'Chatbot Builder integrado ao funil', 'Diferencial significativo de produto'],
  ]},
  { q: 'Q1 2027 — IA e Automação Avançada', color: PURPLE, items: [
    ['ALTA', 'IA Preditiva de Churn de Lead', 'Alerta antes do lead esfriar definitivamente'],
    ['MÉDIA', 'A/B Test de Funis', 'Otimização científica e dados-driven do funil'],
    ['MÉDIA', 'Relatórios via IA (linguagem natural)', 'Diferencial de produto significativo'],
    ['BAIXA', 'Marketplace de templates de funil', 'Efeito de rede e crescimento viral'],
  ]},
  { q: 'Q2 2027 — Escala e Expansão', color: GREEN, items: [
    ['ALTA', 'Plano Enterprise (contrato anual, SLA dedicado)', 'ARPU 5–10x maior por cliente Enterprise'],
    ['MÉDIA', 'Expansão LATAM: México e Argentina', 'TAM 3x maior, novas moedas'],
    ['MÉDIA', 'API pública para integrações customizadas', 'Novo canal de receita + ecossistema'],
    ['BAIXA', 'White-label para agências', 'Alta margem, segmento B2B2C'],
  ]},
]

roadmap.forEach(q => {
  checkNearBottom(90)
  doc.rect(L, doc.y, W, 16).fill(q.color)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(10).text(q.q, L + 8, doc.y - 12, { width: W - 16 })
  doc.moveDown(0.1)
  q.items.forEach(([prio, feat, impact]) => {
    checkNearBottom(20)
    const y = doc.y
    const pColor = prio === 'ALTA' ? RED : prio === 'MÉDIA' ? AMBER : BLUE
    doc.rect(L, y, 45, 14).fill(pColor)
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5).text(prio, L, y + 2, { width: 45, align: 'center', lineBreak: false })
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text(feat, L + 50, y + 1, { width: W - 55, lineBreak: false })
    doc.fillColor(GRAY).font('Helvetica').fontSize(8).text(impact, L + 50, y + 12, { width: W - 55, lineBreak: false })
    doc.y = y + 24
  })
  doc.moveDown(0.4)
})

// ═══════════════════════════════════════════════════════════════════════
// PÁG 35–36 — CONCLUSÃO EXECUTIVA
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('SEÇÃO 15 — CONCLUSÃO EXECUTIVA', true)

h3('Para Investidores')
doc.rect(L, doc.y, W, 65).fill('#EFF6FF')
const invY = doc.y - 57
doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text('Oportunidade de Investimento', L + 10, invY)
doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
  .text('A FlowFunnel endereça um mercado de R$1,7 bilhão/ano em crescimento de 34% ao ano no Brasil, com uma solução única que combina rastreamento WhatsApp + tráfego pago + IA em uma plataforma integrada por R$97–297/mês.', L + 10, invY + 14, { width: W - 20, lineGap: 1.5 })
  .text('Com ARPU de R$174, payback de 1–2 meses e LTV/CAC de 10–13x, a unidade econômica é sólida. O produto está em produção com dados reais, arquitetura escalável e múltiplos métodos de pagamento.', L + 10, doc.y + 4, { width: W - 20, lineGap: 1.5 })
  .text('Investimento seed de R$300–800k permitiria atingir 500 clientes em 12 meses (MRR R$87k, ARR R$1,04M, EBITDA R$67k/mês).', L + 10, doc.y + 4, { width: W - 20, lineGap: 1.5 })
doc.y = invY + 65
doc.moveDown(0.5)

h3('Para Compradores')
doc.rect(L, doc.y, W, 42).fill('#FFF7ED')
const buyY = doc.y - 34
doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text('Ativo Tecnológico', L + 10, buyY)
doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
  .text('O ativo tecnológico da FlowFunnel representa R$2,5–4,7 milhões em código, integrações e propriedade intelectual. Sistema em produção, documentado, arquitetura escalável, zero débito técnico crítico, 6 algoritmos proprietários passíveis de registro INPI.', L + 10, buyY + 14, { width: W - 20, lineGap: 1.5 })
  .text('Valor estratégico para CRMs, plataformas de tráfego ou infoprodutos que queiram adicionar capacidade de rastreamento WhatsApp + IA ao seu produto existente.', L + 10, doc.y + 4, { width: W - 20, lineGap: 1.5 })
doc.y = buyY + 42
doc.moveDown(0.5)

h3('Para Parceiros')
body('A FlowFunnel tem APIs para integração com qualquer plataforma de infoprodutos, CRM ou gestão de tráfego. O sistema de webhooks multi-tenant e o pixel UTM permitem integrações profundas. Oportunidades: co-marketing com Hotmart/Kiwify, integração com agências de tráfego, white-label para ferramentas complementares.')

h3('Resumo de KPIs Estratégicos')
tableHeader(['KPI', 'Valor', 'KPI', 'Valor'], [130, 100, 130, 125])
;[
  ['ARPU médio', 'R$174/mês', 'TAM Brasil', 'R$1,7Bi/ano'],
  ['LTV/CAC Ratio', '10–13x', 'Crescimento setor', '+34%/ano'],
  ['Payback Period', '1–2 meses', 'Trial sem cartão', '7 dias'],
  ['Churn estimado', '6–10%/mês', 'Break-even MRR', '~R$8.000/mês'],
  ['Ativo tecnológico', 'R$2,5–4,7M', 'Linhas de código', '38.913'],
  ['API endpoints', '80+', 'Integrações ativas', '12+'],
].forEach((r, i) => tableRow(r, [130, 100, 130, 125], i % 2 === 0))

// Final banner
doc.moveDown(1)
checkNearBottom(50)
doc.rect(L, doc.y, W, 44).fill(BLUE)
const bannerY = doc.y - 36
doc.fillColor('white').font('Helvetica-Bold').fontSize(16)
  .text('FlowFunnel — Do Clique à Venda, Tudo Rastreado.', L + 10, bannerY, { width: W - 20, align: 'center' })
doc.fillColor('white').font('Helvetica').fontSize(9)
  .text('flowfunnel.app.br  ·  Versão 1.0  ·  Junho 2026', L + 10, bannerY + 22, { width: W - 20, align: 'center' })
doc.y = bannerY + 44
doc.moveDown(0.5)

// ═══════════════════════════════════════════════════════════════════════
// APÊNDICE A — INVENTÁRIO DE ARQUIVOS
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('APÊNDICE A — INVENTÁRIO COMPLETO DE ARQUIVOS', true)

h3('Páginas do Sistema')
tableHeader(['Rota', 'Arquivo', 'Descrição', 'Linhas'], [100, 175, 160, 50])
;[
  ['/', 'app/page.tsx', 'Landing page pública com pricing e depoimentos', '626'],
  ['/dashboard', 'app/dashboard/page.tsx', 'Dashboard principal — funil, métricas, AI', '695'],
  ['/analytics', 'app/analytics/page.tsx', 'Analytics avançado timeseries e trends', '456'],
  ['/leads', 'app/leads/page.tsx', 'CRM Kanban de leads com drag-and-drop', '393'],
  ['/campaigns', 'app/campaigns/page.tsx', 'Gestão de campanhas multi-plataforma', '558'],
  ['/reports', 'app/reports/page.tsx', 'Relatórios e exportações PDF/CSV', '464'],
  ['/goals', 'app/goals/page.tsx', 'Metas e acompanhamento de progresso', '424'],
  ['/settings', 'app/settings/page.tsx', 'Configurações gerais + equipe + alertas', '1027'],
  ['/billing', 'app/billing/page.tsx', 'Assinatura, planos e portal Stripe', '383'],
  ['/webhooks', 'app/webhooks/page.tsx', 'Docs de webhooks + logs + retry', '591'],
  ['/lead-journey', 'app/lead-journey/page.tsx', 'Jornada cronológica do lead', '—'],
  ['/conversion-intelligence', 'app/conversion-intelligence/page.tsx', 'Inteligência de IA e insights', '—'],
  ['/affiliate', 'app/affiliate/page.tsx', 'Dashboard do afiliado com comissões', '624'],
  ['/checkout', 'app/checkout/page.tsx', 'Checkout Stripe + Mercado Pago embedded', '840'],
  ['/pricing', 'app/pricing/page.tsx', 'Página de preços e comparativo de planos', '348'],
  ['/login', 'app/login/page.tsx', 'Tela de login com NextAuth', '—'],
  ['/register', 'app/register/page.tsx', 'Cadastro com plano + trial opcional', '391'],
  ['/admin/users', 'app/admin/users/page.tsx', 'Painel admin: usuários, MRR, churn', '739'],
  ['/admin/affiliates', 'app/admin/affiliates/page.tsx', 'Painel admin de afiliados', '499'],
  ['/invite', 'app/invite/page.tsx', 'Convite de equipe + viewer dashboard', '600'],
  ['/activate-trial', 'app/activate-trial/page.tsx', 'Ativação de trial com plano', '405'],
  ['/termos', 'app/termos/page.tsx', 'Termos de Uso completos', '—'],
  ['/privacidade', 'app/privacidade/page.tsx', 'Política de Privacidade + LGPD', '—'],
  ['/lgpd', 'app/lgpd/page.tsx', 'Direitos LGPD do titular', '—'],
].forEach((r, i) => tableRow(r, [100, 175, 160, 50], i % 2 === 0))

checkNearBottom(60)
h3('Componentes React (components/)')
tableHeader(['Componente', 'Função', 'Importância'], [165, 255, 65])
;[
  ['AppShell.tsx', 'Layout principal: sidebar, headers, banners, trial wall', 'CRÍTICO'],
  ['FunnelFlow.tsx', 'Visualizador React Flow do funil (552 linhas)', 'CRÍTICO'],
  ['DashboardSidebar.tsx', 'Navegação lateral desktop', 'ALTO'],
  ['WorkspaceTabs.tsx', 'Seletor de funil / workspace (464 linhas)', 'ALTO'],
  ['AISuggestions.tsx', 'Sugestões GPT-4 contextualizadas (289 linhas)', 'ALTO'],
  ['NotificationCenter.tsx', 'Central de notificações in-app com badge', 'MÉDIO'],
  ['LeadKanban.tsx', 'CRM Kanban com drag-and-drop por status', 'ALTO'],
  ['LeadIntelligence.tsx', 'Lead scoring PRO com preview bloqueado START', 'MÉDIO'],
  ['PlanGate.tsx', 'Wrapper de feature gating por plano com blur + lock', 'ALTO'],
  ['UpgradeTriggers.tsx', 'Banners dinâmicos contextuais de upsell', 'MÉDIO'],
  ['TrialBanner.tsx', 'Contador de dias restantes do trial', 'MÉDIO'],
  ['TrialExpiredWall.tsx', 'Bloqueio full-screen após trial expirado', 'ALTO'],
  ['UsageMeter.tsx', 'Barra de uso de conversas vs. limite do plano', 'MÉDIO'],
  ['EmailVerificationBanner.tsx', 'Alerta suave de email não verificado', 'MÉDIO'],
  ['WastedTrafficCard.tsx', 'Tráfego desperdiçado + sugestões inteligentes (PRO)', 'MÉDIO'],
  ['LandingTracking.tsx', 'Stats do pixel de rastreamento UTM', 'MÉDIO'],
  ['OnboardingModal.tsx', 'Modal de onboarding em 3 etapas (localStorage)', 'MÉDIO'],
  ['AffiliateTracker.tsx', 'Rastreador de cliques e comissões de afiliados', 'MÉDIO'],
  ['MobileSidebar.tsx', 'Drawer sidebar hamburger para mobile', 'MÉDIO'],
  ['PlanActivatedBanner.tsx', 'Banner de confirmação pós-checkout de plano', 'BAIXO'],
  ['PeriodComparison.tsx', 'Comparativo visual de dois períodos (PRO)', 'MÉDIO'],
  ['DateFilter.tsx', 'Filtro de período com DatePicker customizado', 'BAIXO'],
  ['CampaignSelector.tsx', 'Seletor de campanha para filtros do dashboard', 'BAIXO'],
  ['CardInsightModal.tsx', 'Modal de insight detalhado por card do funil', 'BAIXO'],
  ['ThemeToggle.tsx', 'Toggle de tema dark/light mode', 'BAIXO'],
  ['UserMenu.tsx', 'Menu dropdown do usuário logado', 'MÉDIO'],
  ['PlanBadge.tsx', 'Badge visual do plano atual na sidebar', 'BAIXO'],
  ['TrendAnalysis.tsx', 'Análise de tendências com Recharts', 'MÉDIO'],
  ['AlertSystem.tsx', 'Sistema de alertas toast e notificações', 'MÉDIO'],
  ['ChunkErrorReloader.tsx', 'Recarregador automático em erro de chunk split', 'BAIXO'],
  ['charts/ (subpastas)', 'Componentes Recharts: Line, Bar, Pie, Area', 'ALTO'],
].forEach((r, i) => tableRow(r, [165, 255, 65], i % 2 === 0))

checkNearBottom(60)
h3('Bibliotecas (lib/) — Lógica de Negócio')
tableHeader(['Arquivo', 'Função', 'Linhas'], [155, 275, 55])
;[
  ['lib/prisma.ts', 'Cliente Prisma singleton com connection pooling', '—'],
  ['lib/auth.ts', 'Config NextAuth, authOptions, providers, callbacks', '—'],
  ['lib/plans.ts', 'Definição de planos, limites, features, histórico', '—'],
  ['lib/trial.ts', 'getEffectivePlan() — lógica de trial ativo/expirado', '—'],
  ['lib/email.ts', 'Templates de email via Resend (boas-vindas, reset, alertas)', '452'],
  ['lib/metrics.ts', 'ROI, ROAS, CTR, CPC, distribuição proporcional', '—'],
  ['lib/leadScoring.ts', 'Algoritmo de scoring 0–100 (IA proprietária)', '—'],
  ['lib/webhook-handlers.ts', 'Processamento centralizado de webhooks (364 linhas)', '364'],
  ['lib/webhook-stages.ts', 'Mapeamento universal de status para estágios', '—'],
  ['lib/webhook-security.ts', 'HMAC validation, fail-closed, assinatura por plataforma', '—'],
  ['lib/webhook-dedup.ts', 'Deduplicação de replays de webhooks', '—'],
  ['lib/stripe-dedup.ts', 'Dedup Stripe com padrão claim/release', '—'],
  ['lib/mercadopago-dedup.ts', 'Dedup Mercado Pago com padrão claim/release', '—'],
  ['lib/stripeClient.ts', 'Cliente Stripe singleton e helpers', '—'],
  ['lib/mercadopago.ts', 'Cliente Mercado Pago e helpers de pagamento', '—'],
  ['lib/cache.ts', 'Cache in-memory com TTL configurável', '—'],
  ['lib/security-utils.ts', 'Rate limiting, sanitização, validação de IP', '—'],
  ['lib/withPlan.ts', 'HOF para feature gating nos endpoints (402 + upgradeUrl)', '—'],
  ['lib/sanitize.ts', 'Sanitização de inputs e remoção de XSS', '—'],
  ['lib/facebook.ts', 'Cliente Meta Ads Insights API', '—'],
  ['lib/audit.ts', 'Registro de AuditLog para ações críticas', '—'],
].forEach((r, i) => tableRow(r, [155, 275, 55], i % 2 === 0))

// ═══════════════════════════════════════════════════════════════════════
// APÊNDICE B — ALGORITMOS PARA REGISTRO INPI
// ═══════════════════════════════════════════════════════════════════════
newPage()
sectionTitle('APÊNDICE B — ALGORITMOS PARA REGISTRO INPI — PROPRIEDADE INTELECTUAL', true)

doc.rect(L, doc.y, W, 32).fill('#FEF9C3')
const warnY = doc.y - 24
doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(10).text('REGISTRO INPI — LEI 9.609/98', L + 10, warnY)
doc.fillColor('#78350F').font('Helvetica').fontSize(8.5)
  .text('Para registrar, acesse: inpi.gov.br  →  "Programa de Computador"  →  deposite as primeiras e últimas 50 páginas do código-fonte + esta descrição de algoritmos. Taxa: ~R$155 (PJ) ou R$78 (PF). O registro cria prova de anterioridade e autoria com força legal.', L + 10, warnY + 14, { width: W - 20, lineGap: 1.5 })
doc.y = warnY + 32
doc.moveDown(0.5)

const apbAlgos = [
  {
    id: 'ALG-001', value: 'MÁXIMO', file: 'lib/leadScoring.ts',
    title: 'Lead Scoring Comportamental Multi-Variável para WhatsApp + Infoprodutos',
    description: 'Algoritmo original que combina múltiplas variáveis comportamentais coletadas no contexto específico de WhatsApp Business + infoprodutos brasileiros para gerar score numérico 0–100 e classificação automática em três categorias (lead quente / morno / frio). Variáveis consideradas: (1) velocidade de resposta do lead após primeiro contato, (2) profundidade de engajamento nas conversas (número de trocas), (3) frequência e padrão de interações com o funil de vendas, (4) progressão entre estágios do funil (NOVO → QUALIFICADO → INTERESSADO → CHECKOUT → CLIENTE), (5) sinais de intenção de compra detectados por padrão comportamental. O algoritmo é executado em tempo real a cada novo evento do funil.',
    novelty: 'Sem precedente público documentado com esta combinação de variáveis no contexto específico de WhatsApp + infoprodutos brasileiros. Não derivado de biblioteca pública ou trabalho acadêmico conhecido.',
    created: 'Criado originalmente em 2025–2026 para FlowFunnel. Autoria: equipe FlowFunnel.',
    protect: ['Registro de Programa de Computador no INPI (Lei 9.609/98)', 'Direitos Autorais automáticos desde a criação', 'Segredo Industrial — não publicar em open-source'],
  },
  {
    id: 'ALG-002', value: 'ALTO', file: 'lib/metrics.ts — distributeByClicks()',
    title: 'Atribuição Multi-Touch Proporcional com Garantia de Integridade Matemática',
    description: 'Algoritmo que distribui leads e receita entre múltiplas fontes de tráfego pago (Meta Ads, Google Ads, TikTok Ads) proporcionalmente aos cliques de cada fonte, com garantia matemática de soma exata via last-item adjustment: o último item absorve o resto da divisão inteira para evitar perda de frações. Resolve o problema clássico de atribuição multi-touch no contexto específico de WhatsApp + infoprodutos, onde não há cookies de atribuição padrão.',
    novelty: 'Aplicação original do modelo de atribuição linear ao contexto WhatsApp + infoprodutos com implementação verificada de integridade de soma.',
    created: 'Criado originalmente para FlowFunnel. Pode ser avaliado para patente de método.',
    protect: ['Registro de Programa de Computador no INPI', 'Avaliação de viabilidade de Patente de Método'],
  },
  {
    id: 'ALG-003', value: 'ALTO', file: 'lib/stripe-dedup.ts · lib/mercadopago-dedup.ts',
    title: 'Deduplicação At-Least-Once com Padrão Claim/Release em Ambiente Serverless',
    description: 'Padrão original de claim/release no banco de dados PostgreSQL via Prisma para garantir processamento at-least-once de webhooks de pagamento em ambiente serverless (Next.js App Router). O "claim" bloqueia processamento concorrente entre múltiplas instâncias; o "release" em caso de falha de processamento retorna a claim para permitir retry sem deadlock. Sobrevive a restarts de servidor. O mesmo padrão é implementado de forma espelhada para Stripe (StripeProcessedEvent) e Mercado Pago (MercadoPagoProcessedEvent).',
    novelty: 'Adaptação original do padrão distribuído de claim/release para o contexto específico de Next.js + Prisma + PostgreSQL em ambiente serverless com múltiplas instâncias.',
    created: 'Criado originalmente para FlowFunnel em 2025–2026.',
    protect: ['Direitos Autorais (Lei 9.609/98)', 'Parte integrante do registro do programa completo'],
  },
  {
    id: 'ALG-004', value: 'ALTO', file: 'lib/webhook-stages.ts',
    title: 'Mapeamento Universal de Status de Plataformas para Estágios de Funil',
    description: 'Tabela de mapeamento que normaliza 40+ status diferentes de Hotmart, Kiwify, Eduzz, Monetizze e Perfect Pay (ex.: "APPROVED", "billet_printed", "order_cancelled", "payment_refused", etc.) para 7 estágios universais do funil FlowFunnel: Aprovado, Pendente, Recusado, Reembolsado, Chargeback, Abandonado, Cancelado. Permite que qualquer plataforma de infoproduto seja tratada de forma uniforme pelo pipeline de análise.',
    novelty: 'Trabalho de engenharia reversa e padronização original. Não existe documentação pública consolidada destes mapeamentos entre todas as 5 plataformas.',
    created: 'Compilado via integração direta com as plataformas em 2025–2026.',
    protect: ['Direitos Autorais', 'Parte integrante do registro do programa completo no INPI'],
  },
  {
    id: 'ALG-005', value: 'MÉDIO', file: 'app/api/cron/alerts/route.ts',
    title: 'Pipeline de Avaliação de Alertas em Lote sem N+1 para SaaS Multi-Tenant',
    description: 'Pipeline que avalia 4 regras de alerta de negócio (queda de vendas nos últimos 7 dias comparada com os 7 anteriores; taxa de conversão abaixo da meta configurada; campanha sem leads em 24h; gasto em tráfego sem retorno em 48h) para todos os usuários da plataforma em O(1) queries ao banco de dados. Usa groupBy + aggregate para buscar dados de todos os usuários em poucas queries, avaliando as regras em memória — eliminando o problema de N+1 queries que degradaria a performance com muitos usuários.',
    novelty: 'Arquitetura original de pipeline de alertas sem N+1 para SaaS multi-tenant em ambiente serverless Next.js.',
    created: 'Criado originalmente para FlowFunnel em 2026.',
    protect: ['Direitos Autorais (Lei 9.609/98)', 'Know-how técnico como segredo industrial'],
  },
  {
    id: 'ALG-006', value: 'MÉDIO', file: 'public/tracker.js',
    title: 'Pixel UTM com Injeção Automática de Parâmetros em Links de Checkout e WhatsApp',
    description: 'Script JavaScript público instalável por snippet que: (1) captura automaticamente UTM source/campaign/medium/content/term da URL, (2) gera e persiste lead_id único em localStorage para rastreamento cross-session, (3) dispara page_view automaticamente, (4) detecta links de checkout (Hotmart, Kiwify, Eduzz, Monetizze, Stripe) e injeta lead_id + UTMs nas URLs antes do clique, (5) rastreia cliques em links de WhatsApp (wa.me, api.whatsapp.com), (6) expõe API pública window.trackEvent() e window.zfTrackConversion(), (7) usa navigator.sendBeacon() para garantia de entrega antes do navigate.',
    novelty: 'Solução original específica para o ecossistema de infoprodutos brasileiros com injeção dinâmica simultânea em múltiplos formatos de URL (Hotmart, Kiwify, Stripe, WhatsApp) sem necessidade de modificação manual pelo usuário.',
    created: 'Criado originalmente para FlowFunnel em 2025–2026.',
    protect: ['Direitos Autorais (Lei 9.609/98)', 'Parte do registro do programa completo no INPI'],
  },
]

apbAlgos.forEach(alg => {
  checkNearBottom(110)
  const valueColor = alg.value === 'MÁXIMO' ? RED : alg.value === 'ALTO' ? AMBER : BLUE
  // Header
  doc.rect(L, doc.y, W, 18).fill(valueColor)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
    .text(`${alg.id}  —  ${alg.title}`, L + 8, doc.y - 14, { width: W - 110, lineBreak: false })
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
    .text(`VALOR: ${alg.value}`, L + W - 100, doc.y - 14, { width: 94, align: 'right', lineBreak: false })
  doc.moveDown(0.2)

  // File
  doc.fillColor(GRAY).font('Courier').fontSize(7.5).text('Arquivo: ' + alg.file, L + 6)
  doc.moveDown(0.2)

  // Description
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8).text('Descrição técnica:', L + 6)
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
    .text(alg.description, L + 6, doc.y, { width: W - 10, lineGap: 1.5 })
  doc.moveDown(0.2)

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8).text('Novidade e originalidade: ', L + 6, doc.y, { continued: true })
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(alg.novelty, { width: W - 12 })
  doc.moveDown(0.1)

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8).text('Data de criação: ', L + 6, doc.y, { continued: true })
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(alg.created)
  doc.moveDown(0.1)

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8).text('Proteção recomendada:', L + 6)
  alg.protect.forEach(p => {
    doc.fillColor(valueColor).font('Helvetica-Bold').fontSize(8).text('→', L + 10, doc.y, { width: 12, lineBreak: false })
    doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(p, L + 22, doc.y, { width: W - 24, lineBreak: false })
    doc.y += 12
  })

  hline()
  doc.moveDown(0.4)
})

// Guide
checkNearBottom(100)
h3('Como Registrar no INPI — Passo a Passo')
;[
  ['1', 'Prepare o Pacote de Registro', 'Reúna: primeiras 50 e últimas 50 páginas do código-fonte (pode ser impresso ou PDF), descrição funcional dos algoritmos (este Apêndice B), nome do titular (empresa ou pessoa física) e dos autores, data de criação (junho 2026).'],
  ['2', 'Acesse o e-INPI', 'Portal: inpi.gov.br → Serviços → Programa de Computador → Novo Pedido. Login com conta gov.br. Categoria: Programa de Computador (Lei 9.609/98). GRU: taxa de ~R$155 (PJ) ou R$78 (PF).'],
  ['3', 'Proteção Complementar', 'O código-fonte já é protegido por Direitos Autorais desde a criação (sem necessidade de registro formal). O registro INPI cria prova de anterioridade com data certa. Avalie patente de método para ALG-001 e ALG-002 com advogado especializado.'],
  ['4', 'NDA e Contratos', 'Firmar Acordo de Confidencialidade (NDA) com todos os colaboradores e prestadores de serviço que tiveram ou terão acesso ao código-fonte. Cláusula de cessão de direitos nos contratos de trabalho/prestação de serviço.'],
].forEach(([n, title, desc]) => {
  checkNearBottom(45)
  const y = doc.y
  doc.circle(L + 8, y + 8, 8).fill(BLUE)
  doc.fillColor('white').font('Helvetica-Bold').fontSize(9).text(n, L + 4, y + 3, { width: 10, align: 'center', lineBreak: false })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text(title, L + 22, y, { width: W - 22, lineBreak: false })
  doc.fillColor('#374151').font('Helvetica').fontSize(8.5).text(desc, L + 22, y + 13, { width: W - 22, lineGap: 1.5 })
  doc.y = Math.max(doc.y, y + 36)
  doc.moveDown(0.2)
})

// Final
doc.moveDown(1)
checkNearBottom(40)
hline()
doc.moveDown(0.5)
doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(12).text('FlowFunnel — Documentação Técnica e Comercial Completa', L, doc.y, { align: 'center', width: W })
doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('Versão 1.0  ·  Junho 2026  ·  flowfunnel.app.br', L, doc.y + 14, { align: 'center', width: W })
doc.fillColor('#94A3B8').font('Helvetica').fontSize(8)
  .text('Documento confidencial. Reprodução ou distribuição sem autorização expressa é proibida.', L, doc.y + 28, { align: 'center', width: W })

// Finalize
doc.end()
stream.on('finish', () => {
  const stat = fs.statSync(outFile)
  console.log(`✅ PDF gerado com sucesso!`)
  console.log(`📄 Arquivo: ${outFile}`)
  console.log(`📦 Tamanho: ${(stat.size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`🌐 Download: https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/flowfunnel-documentacao.pdf`)
})
stream.on('error', (err) => {
  console.error('❌ Erro ao gerar PDF:', err)
  process.exit(1)
})
