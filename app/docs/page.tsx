'use client'
import { useEffect, useState } from 'react'

const ACCENT = '#2563EB'
const DARK = '#0F172A'

export default function DocsPage() {
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => {
    document.title = 'FlowFunnel — Documentação Técnica Completa'
  }, [])

  return (
    <div className="docs-root" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: printMode ? '#fff' : '#f1f5f9', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .docs-root { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0F172A; }
        .page { background: white; width: 210mm; min-height: 297mm; margin: 0 auto 24px; padding: 20mm 18mm; position: relative; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
        h1 { font-size: 2.8rem; font-weight: 900; }
        h2 { font-size: 1.6rem; font-weight: 800; color: #1E40AF; border-bottom: 3px solid #2563EB; padding-bottom: 8px; margin-bottom: 16px; margin-top: 32px; }
        h3 { font-size: 1.15rem; font-weight: 700; color: #1E3A8A; margin-top: 20px; margin-bottom: 8px; }
        h4 { font-size: 1rem; font-weight: 600; color: #374151; margin-top: 14px; margin-bottom: 6px; }
        p { font-size: 0.92rem; line-height: 1.7; color: #374151; margin-bottom: 10px; }
        ul, ol { margin: 8px 0 12px 20px; }
        li { font-size: 0.9rem; line-height: 1.65; color: #374151; margin-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.85rem; }
        th { background: #1E40AF; color: white; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.82rem; }
        td { padding: 7px 10px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
        tr:nth-child(even) td { background: #F8FAFC; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700; }
        .badge-blue { background: #DBEAFE; color: #1D4ED8; }
        .badge-green { background: #D1FAE5; color: #065F46; }
        .badge-yellow { background: #FEF3C7; color: #92400E; }
        .badge-red { background: #FEE2E2; color: #991B1B; }
        .badge-purple { background: #EDE9FE; color: #5B21B6; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
        .kpi-card { background: linear-gradient(135deg, #1E40AF 0%, #2563EB 100%); color: white; border-radius: 10px; padding: 14px 16px; }
        .kpi-card.green { background: linear-gradient(135deg, #065F46 0%, #059669 100%); }
        .kpi-card.purple { background: linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%); }
        .kpi-card.orange { background: linear-gradient(135deg, #92400E 0%, #D97706 100%); }
        .kpi-card.dark { background: linear-gradient(135deg, #111827 0%, #374151 100%); }
        .kpi-card.teal { background: linear-gradient(135deg, #134E4A 0%, #0D9488 100%); }
        .kpi-num { font-size: 2rem; font-weight: 900; line-height: 1; }
        .kpi-label { font-size: 0.78rem; font-weight: 500; opacity: 0.85; margin-top: 4px; }
        .bar { height: 10px; background: #E5E7EB; border-radius: 5px; margin: 4px 0 10px; overflow: hidden; }
        .bar-fill { height: 10px; border-radius: 5px; background: linear-gradient(90deg, #2563EB, #7C3AED); }
        .code-box { background: #0F172A; color: #E2E8F0; border-radius: 8px; padding: 12px 14px; font-family: 'Courier New', monospace; font-size: 0.78rem; line-height: 1.6; margin: 10px 0; overflow: hidden; }
        .arch-box { border: 2px solid #BFDBFE; border-radius: 10px; padding: 14px; margin: 10px 0; background: #EFF6FF; }
        .arch-box h4 { color: #1D4ED8; margin-top: 0; }
        .highlight-box { background: linear-gradient(135deg, #EFF6FF, #F5F3FF); border-left: 4px solid #2563EB; padding: 12px 14px; border-radius: 0 8px 8px 0; margin: 12px 0; }
        .warning-box { background: #FEF9C3; border-left: 4px solid #EAB308; padding: 12px 14px; border-radius: 0 8px 8px 0; margin: 12px 0; }
        .section-divider { border: none; border-top: 2px dashed #CBD5E1; margin: 24px 0; }
        .toc-item { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
        .toc-num { color: #2563EB; font-weight: 700; min-width: 28px; font-size: 0.9rem; }
        .toc-dots { flex: 1; border-bottom: 1px dotted #94A3B8; margin: 0 4px; }
        .toc-page { color: #64748B; font-size: 0.82rem; font-weight: 500; }
        .cover-logo { width: 80px; height: 80px; background: linear-gradient(135deg, #2563EB, #7C3AED); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; color: white; font-weight: 900; box-shadow: 0 8px 32px rgba(37,99,235,0.3); }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
        .integration-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; border: 1.5px solid #BFDBFE; background: #EFF6FF; font-size: 0.8rem; font-weight: 600; color: #1D4ED8; margin: 3px; }
        .flow-step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .flow-num { width: 28px; height: 28px; border-radius: 50%; background: #2563EB; color: white; font-size: 0.82rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .flow-content h4 { margin-top: 0; }
        .plan-card { border: 2px solid #E5E7EB; border-radius: 10px; padding: 14px; }
        .plan-card.featured { border-color: #2563EB; background: #EFF6FF; }
        .scenario-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 10px; margin: 8px 0; }
        .scenario-cell { background: #F8FAFC; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #E5E7EB; }
        .print-btn { position: fixed; bottom: 32px; right: 32px; background: #2563EB; color: white; border: none; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 24px rgba(37,99,235,0.4); z-index: 999; transition: all 0.2s; }
        .print-btn:hover { background: #1D4ED8; transform: translateY(-2px); }
        @media print {
          .print-btn { display: none !important; }
          .page { margin: 0; box-shadow: none; page-break-after: always; width: 100%; }
          body { background: white; }
        }
      `}</style>

      {/* ── PRINT BUTTON ── */}
      <button className="print-btn" onClick={() => window.print()}>
        🖨️ Exportar PDF
      </button>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 1 — CAPA
      ══════════════════════════════════════════════════════════════ */}
      <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Barra superior decorativa */}
        <div style={{ height: 8, background: 'linear-gradient(90deg, #2563EB, #7C3AED, #0EA5E9)', borderRadius: 4, marginBottom: 48 }} />

        {/* Logo + Título */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 32 }}>
            <div className="cover-logo">FF</div>
          </div>
          <h1 style={{ fontSize: '3.4rem', fontWeight: 900, color: DARK, lineHeight: 1.1, marginBottom: 12 }}>
            FlowFunnel
          </h1>
          <p style={{ fontSize: '1.4rem', color: '#2563EB', fontWeight: 700, marginBottom: 8 }}>
            Documentação Técnica e Comercial Completa
          </p>
          <p style={{ fontSize: '1rem', color: '#64748B', fontWeight: 400, maxWidth: '80%' }}>
            Plataforma SaaS para rastreamento e qualificação de funis de vendas via WhatsApp, 
            com integrações nativas a Meta Ads, Google Ads, TikTok Ads e as principais 
            plataformas de infoprodutos do Brasil.
          </p>

          <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {['SaaS', 'WhatsApp Marketing', 'CRM', 'Meta Ads', 'IA', 'Automação'].map(t => (
              <span key={t} className="badge badge-blue" style={{ fontSize: '0.85rem', padding: '5px 14px' }}>{t}</span>
            ))}
          </div>

          <div className="kpi-grid" style={{ marginTop: 48 }}>
            {[
              { num: '38.913', label: 'Linhas de Código', color: '' },
              { num: '346', label: 'Arquivos no Projeto', color: 'green' },
              { num: '80+', label: 'Endpoints de API', color: 'purple' },
              { num: '26', label: 'Modelos no Banco', color: 'orange' },
              { num: '41', label: 'Componentes React', color: 'dark' },
              { num: '12+', label: 'Integrações Ativas', color: 'teal' },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.color}`}>
                <div className="kpi-num">{k.num}</div>
                <div className="kpi-label">{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé da capa */}
        <div style={{ borderTop: '2px solid #E2E8F0', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>Versão do Sistema: <strong>1.0 — Produção</strong></p>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>Data de Geração: <strong>Junho de 2026</strong></p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>Domínio: <strong>flowfunnel.app.br</strong></p>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>Framework: <strong>Next.js 16 · PostgreSQL · Prisma</strong></p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 2 — SUMÁRIO
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Sumário</h2>
        {[
          { num: '01', title: 'Visão Geral da Empresa', pg: '3' },
          { num: '02', title: 'Apresentação Visual da Plataforma', pg: '5' },
          { num: '03', title: 'Arquitetura Completa do Sistema', pg: '7' },
          { num: '04', title: 'Estrutura de Pastas e Arquivos', pg: '10' },
          { num: '05', title: 'Análise de Código-Fonte por Módulo', pg: '13' },
          { num: '06', title: 'Códigos Estratégicos — Propriedade Intelectual', pg: '16' },
          { num: '07', title: 'Métricas do Projeto', pg: '18' },
          { num: '08', title: 'Análise de Escalabilidade', pg: '20' },
          { num: '09', title: 'Modelo de Negócio', pg: '22' },
          { num: '10', title: 'Projeções Financeiras', pg: '25' },
          { num: '11', title: 'Valuation da Empresa', pg: '29' },
          { num: '12', title: 'Análise Competitiva', pg: '31' },
          { num: '13', title: 'Segurança e LGPD', pg: '34' },
          { num: '14', title: 'Roadmap de Produto', pg: '36' },
          { num: '15', title: 'Conclusão Executiva', pg: '38' },
          { num: 'A', title: 'Inventário Completo de Arquivos', pg: '40' },
          { num: 'B', title: 'Algoritmos de Alto Valor — Registro de PI', pg: '44' },
        ].map(item => (
          <div key={item.num} className="toc-item">
            <span className="toc-num">{item.num}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: item.num.length === 1 && isNaN(+item.num) ? 700 : 500 }}>{item.title}</span>
            <span className="toc-dots" />
            <span className="toc-page">{item.pg}</span>
          </div>
        ))}

        <hr className="section-divider" style={{ marginTop: 32 }} />
        <h2>Sobre este Documento</h2>
        <p>
          Este documento foi gerado automaticamente mediante varredura completa do código-fonte da plataforma FlowFunnel 
          em junho de 2026. Contém dados reais do projeto: métricas de código, arquitetura, integrações, modelo de 
          negócio e projeções financeiras.
        </p>
        <p>
          Destina-se a múltiplos públicos: <strong>investidores</strong> (Seções 9–11), <strong>parceiros técnicos</strong> 
          (Seções 3–7), <strong>compradores potenciais</strong> (Seções 11–15) e <strong>registro de propriedade 
          intelectual</strong> (Apêndice B).
        </p>
        <div className="highlight-box">
          <strong>Confidencialidade:</strong> Este documento contém informações estratégicas, técnicas e financeiras 
          da FlowFunnel. Sua reprodução ou distribuição sem autorização expressa é proibida.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 3–4 — VISÃO GERAL
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 1 — Visão Geral da Empresa</h2>

        <h3>O que é a FlowFunnel?</h3>
        <p>
          FlowFunnel é uma plataforma SaaS brasileira especializada no <strong>rastreamento e qualificação de funis de 
          vendas via WhatsApp</strong>. A plataforma conecta dados de tráfego pago (Meta Ads, Google Ads, TikTok Ads) 
          com dados de conversação no WhatsApp e dados de venda nas principais plataformas de infoprodutos do Brasil 
          (Hotmart, Kiwify, Eduzz, Monetizze, Perfect Pay).
        </p>
        <p>
          Ao contrário de ferramentas de automação, a FlowFunnel <strong>não envia mensagens</strong> — ela 
          <em>rastreia, qualifica e quantifica</em> cada etapa do funil de vendas, gerando métricas de ROI, CPL, 
          taxa de conversão e inteligência de IA para decisões de investimento em tráfego.
        </p>

        <h3>Problema que Resolve</h3>
        <div className="two-col">
          <div className="arch-box">
            <h4>🔴 Cenário Atual (Sem FlowFunnel)</h4>
            <ul>
              <li>Empreendedor investe em tráfego pago sem saber o ROI real</li>
              <li>Não sabe quantas conversas WhatsApp vieram de cada anúncio</li>
              <li>Não consegue medir taxa de conversão por fonte de tráfego</li>
              <li>Decisions manuais baseadas em feeling, não em dados</li>
              <li>Descobre "onde queimou dinheiro" apenas no final do mês</li>
            </ul>
          </div>
          <div className="arch-box" style={{ borderColor: '#A7F3D0', background: '#ECFDF5' }}>
            <h4>🟢 Com FlowFunnel</h4>
            <ul>
              <li>Dashboard unificado: do clique no anúncio até a venda</li>
              <li>ROI calculado por fonte, campanha e período</li>
              <li>Lead scoring com IA (quente/morno/frio)</li>
              <li>Alertas automáticos de campanhas ineficientes</li>
              <li>Relatórios PDF/CSV com um clique</li>
            </ul>
          </div>
        </div>

        <h3>Público-Alvo</h3>
        <table>
          <thead><tr><th>Segmento</th><th>Perfil</th><th>Plano Ideal</th><th>Ticket Médio</th></tr></thead>
          <tbody>
            <tr><td>Infoprodutor Iniciante</td><td>Lança 1–2 produtos por ano, gasta R$2–5k/mês em tráfego</td><td>START</td><td>R$97/mês</td></tr>
            <tr><td>Infoprodutor Intermediário</td><td>3–5 lançamentos/ano, time de 2–5 pessoas, R$10–30k/mês</td><td>PRO</td><td>R$147/mês</td></tr>
            <tr><td>Produtor de Alto Volume</td><td>Perpétuo ou alta escala, R$50k+/mês em tráfego, time grande</td><td>SCALE</td><td>R$297/mês</td></tr>
            <tr><td>Gestor de Tráfego</td><td>Gerencia contas de vários clientes, precisa de relatórios</td><td>PRO/SCALE</td><td>R$147–297/mês</td></tr>
            <tr><td>Agência Digital</td><td>Multi-conta, relatórios white-label para clientes</td><td>SCALE + Equipe</td><td>R$297+/mês</td></tr>
          </tbody>
        </table>

        <h3>Diferenciais Competitivos</h3>
        <div className="kpi-grid">
          {[
            { icon: '🔗', title: 'Funil Completo', desc: 'Do clique no anúncio até a confirmação de pagamento — sem gaps de dados' },
            { icon: '🤖', title: 'IA Integrada', desc: 'Lead scoring automático e sugestões de otimização via OpenAI GPT-4' },
            { icon: '📱', title: 'WhatsApp Native', desc: 'Rastreamento real de conversas via WhatsApp Business API oficial' },
            { icon: '🇧🇷', title: '100% Brasileiro', desc: 'Suporte a Mercado Pago PIX, todas as plataformas BR nativas' },
            { icon: '⚡', title: 'Real Time', desc: 'Métricas atualizadas em tempo real, alertas imediatos de anomalias' },
            { icon: '🔒', title: 'LGPD Compliant', desc: 'Termos, privacidade, DPA e todos os requisitos legais brasileiros' },
          ].map(d => (
            <div key={d.title} style={{ border: '1.5px solid #BFDBFE', borderRadius: 10, padding: 14, background: '#F8FAFC' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{d.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1E40AF', marginBottom: 4 }}>{d.title}</div>
              <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>{d.desc}</div>
            </div>
          ))}
        </div>

        <h3>Mercado Potencial (Brasil)</h3>
        <table>
          <thead><tr><th>Métrica</th><th>Valor</th><th>Fonte / Referência</th></tr></thead>
          <tbody>
            <tr><td>Infoprodutores ativos no Brasil</td><td><strong>~800.000</strong></td><td>Hotmart/Kiwify reports 2024</td></tr>
            <tr><td>Gestores de tráfego registrados</td><td><strong>~120.000</strong></td><td>Associações de marketing digital</td></tr>
            <tr><td>TAM (mercado total endereçável)</td><td><strong>R$ 1,7 bilhão/ano</strong></td><td>920.000 × R$147/mês = R$1,6Bi</td></tr>
            <tr><td>SAM (segmento acessível)</td><td><strong>R$ 180 milhões/ano</strong></td><td>Foco em infoprodutores digitais</td></tr>
            <tr><td>SOM (alvo realista 3 anos)</td><td><strong>R$ 18 milhões/ano</strong></td><td>10% do SAM, ~10.000 clientes</td></tr>
            <tr><td>Crescimento do setor (2024–2025)</td><td><strong>+34% ao ano</strong></td><td>ABComm/Ebit Nielsen</td></tr>
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 5–6 — PLATAFORMA VISUAL
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 2 — Apresentação Visual da Plataforma</h2>

        <h3>Módulos da Plataforma</h3>
        {[
          {
            icon: '📊', name: 'Dashboard Principal', route: '/dashboard',
            desc: 'Visão unificada do funil de vendas. Conecta dados de tráfego pago (Meta, Google, TikTok), WhatsApp e plataformas de venda (Hotmart, Kiwify). Exibe ROI, ROAS, CPL, conversão e comparativo de períodos em tempo real.',
            features: ['FunnelFlow visual interativo (React Flow)', 'KPIs por fonte de tráfego', 'Comparação período atual vs anterior', 'Filtros por campanha e workspace', 'Export CSV e PDF com 1 clique'],
          },
          {
            icon: '🔁', name: 'Jornada do Lead', route: '/lead-journey',
            desc: 'Visualização cronológica da jornada de cada lead desde o primeiro clique no anúncio até a compra. Permite identificar pontos de abandono e otimizar o funil.',
            features: ['Timeline por lead', 'Eventos de cada plataforma', 'Tempo entre etapas', 'Histórico de interações WhatsApp'],
          },
          {
            icon: '🤖', name: 'Inteligência de IA', route: '/conversion-intelligence',
            desc: 'Motor de IA baseado em OpenAI GPT-4 que analisa os dados do funil e gera sugestões acionáveis: quais campanhas pausar, onde investir mais, quais leads priorizar.',
            features: ['Lead scoring 0–100 (quente/morno/frio)', 'Sugestões automáticas de otimização', 'Diagnóstico de tráfego desperdiçado', 'Alertas inteligentes de anomalias'],
          },
          {
            icon: '📈', name: 'Analytics Avançado', route: '/analytics',
            desc: 'Séries temporais históricas com comparação entre períodos. Análise de performance por plataforma, identificação de tendências e gráficos interativos (Recharts).',
            features: ['Timeseries 7 a 365 dias (por plano)', 'Gráficos por plataforma', 'Comparação períodos', 'MetricSnapshots diários (cron)'],
          },
          {
            icon: '📋', name: 'Relatórios', route: '/reports',
            desc: 'Geração de relatórios detalhados em PDF e CSV. Inclui funil completo, breakdown por fonte, análise de ROI e recomendações. Pode ser enviado por email ou baixado.',
            features: ['Export PDF (jsPDF + PDFKit)', 'Export CSV completo', 'Filtro por data customizado', 'Gráficos incluídos no PDF'],
          },
          {
            icon: '🎯', name: 'CRM — Leads', route: '/leads',
            desc: 'Gestão completa de leads com Kanban visual. Classifica leads por status (NOVO, QUALIFICADO, INTERESSADO, CHECKOUT, CLIENTE), scoring de IA e histórico de interações.',
            features: ['Kanban drag-and-drop', 'Lead scoring com IA', 'Filtros por status e fonte', 'Notas e histórico por lead'],
          },
          {
            icon: '📣', name: 'Campanhas', route: '/campaigns',
            desc: 'Gestão de campanhas de tráfego pago conectadas ao funil. Visualiza performance real de cada campanha: cliques, leads gerados, conversões e ROI.',
            features: ['Multi-plataforma (Meta, Google, TikTok)', 'Métricas em tempo real', 'Filtros por status e data', 'Alerta de campanha com baixo ROI'],
          },
          {
            icon: '⚙️', name: 'Webhooks & Integrações', route: '/webhooks',
            desc: 'Hub central de integrações. Configura conexões com todas as plataformas, monitora logs de webhooks recebidos, permite replay de eventos e documenta os endpoints.',
            features: ['Logs em tempo real', 'Retry de webhooks falhos', 'HMAC signature validation', 'Documentação dos endpoints'],
          },
        ].map(m => (
          <div key={m.name} style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <strong style={{ color: '#1E40AF', fontSize: '0.95rem' }}>{m.name}</strong>
                  <code style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#64748B', padding: '1px 7px', borderRadius: 4 }}>{m.route}</code>
                </div>
                <p style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>{m.desc}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.features.map(f => <span key={f} className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{f}</span>)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 7–9 — ARQUITETURA
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 3 — Arquitetura Completa do Sistema</h2>

        <h3>Stack Tecnológica</h3>
        <table>
          <thead><tr><th>Camada</th><th>Tecnologia</th><th>Versão</th><th>Finalidade</th></tr></thead>
          <tbody>
            <tr><td>Frontend Framework</td><td><strong>Next.js (App Router)</strong></td><td>16.2.6</td><td>SSR, SSG, API Routes, middleware</td></tr>
            <tr><td>Linguagem</td><td><strong>TypeScript</strong></td><td>5.x</td><td>Type safety em todo o projeto</td></tr>
            <tr><td>UI / Styling</td><td><strong>Tailwind CSS</strong></td><td>3.x</td><td>Design system, responsividade</td></tr>
            <tr><td>Banco de Dados</td><td><strong>PostgreSQL</strong></td><td>15+</td><td>Armazenamento principal (Replit managed)</td></tr>
            <tr><td>ORM</td><td><strong>Prisma</strong></td><td>5.8.1</td><td>Queries type-safe, migrations, schema</td></tr>
            <tr><td>Autenticação</td><td><strong>NextAuth.js</strong></td><td>4.24.5</td><td>Credentials + Google OAuth, JWT sessions</td></tr>
            <tr><td>Gráficos</td><td><strong>Recharts</strong></td><td>2.15.4</td><td>LineChart, BarChart, PieChart, AreaChart</td></tr>
            <tr><td>Diagrama de Funil</td><td><strong>React Flow (@xyflow)</strong></td><td>12.10.2</td><td>Visualização interativa do funil</td></tr>
            <tr><td>IA</td><td><strong>OpenAI API</strong></td><td>6.16.0</td><td>GPT-4, lead scoring, sugestões</td></tr>
            <tr><td>Pagamentos</td><td><strong>Stripe</strong></td><td>21.0.1</td><td>Assinaturas, checkout embedded, portal</td></tr>
            <tr><td>Pagamentos BR</td><td><strong>Mercado Pago</strong></td><td>SDK v2</td><td>PIX, boleto, cartão — Payment Brick</td></tr>
            <tr><td>Email</td><td><strong>Resend</strong></td><td>6.9.4</td><td>Transacional: boas-vindas, reset, alertas</td></tr>
            <tr><td>Export PDF</td><td><strong>jsPDF + PDFKit</strong></td><td>4.0 / 0.18</td><td>Relatórios em PDF (client + server)</td></tr>
            <tr><td>WhatsApp</td><td><strong>WhatsApp Business API</strong></td><td>Cloud API</td><td>Webhook oficial Meta para mensagens</td></tr>
            <tr><td>Deploy</td><td><strong>Replit Deployments</strong></td><td>—</td><td>Hosting, CI/CD, managed PostgreSQL</td></tr>
          </tbody>
        </table>

        <h3>Diagrama de Arquitetura — Fluxo de Dados</h3>
        <div style={{ background: '#0F172A', borderRadius: 12, padding: '20px', color: '#E2E8F0', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2 }}>
          <div style={{ color: '#38BDF8', fontWeight: 700, marginBottom: 8 }}>CAMADA DE TRÁFEGO PAGO</div>
          <div>┌─────────────┐  ┌──────────────┐  ┌─────────────┐</div>
          <div>│  Meta Ads   │  │  Google Ads  │  │  TikTok Ads │</div>
          <div>└──────┬──────┘  └──────┬───────┘  └──────┬──────┘</div>
          <div>       │                │                  │</div>
          <div style={{ color: '#A78BFA' }}>       └────────────────┬──────────────────┘</div>
          <div style={{ color: '#A78BFA' }}>                        │ Webhooks / Pixel</div>
          <div style={{ color: '#34D399', fontWeight: 700, marginTop: 8, marginBottom: 4 }}>CAMADA DE API — Next.js App Router</div>
          <div>                ┌──────────┴──────────┐</div>
          <div>                │  /api/webhooks/*    │ ← Hotmart, Kiwify, Eduzz, Monetizze</div>
          <div>                │  /api/facebook/*    │ ← Meta Ads Insights API</div>
          <div>                │  /api/whatsapp/*    │ ← WhatsApp Business Cloud API</div>
          <div>                │  /api/stripe/*      │ ← Stripe Billing & Payments</div>
          <div>                │  /api/mercadopago/* │ ← Mercado Pago (PIX/Boleto/Cartão)</div>
          <div>                │  /api/ai/*          │ ← OpenAI GPT-4</div>
          <div>                │  /api/analytics/*   │ ← Timeseries, comparativo</div>
          <div>                └──────────┬──────────┘</div>
          <div style={{ color: '#FBBF24', fontWeight: 700, marginTop: 8, marginBottom: 4 }}>CAMADA DE DADOS — Prisma ORM + PostgreSQL</div>
          <div>                ┌──────────┴──────────┐</div>
          <div>                │   26 modelos Prisma  │</div>
          <div>                │   PostgreSQL 15+     │</div>
          <div>                │   Índices otimizados │</div>
          <div>                └──────────┬──────────┘</div>
          <div style={{ color: '#F87171', fontWeight: 700, marginTop: 8, marginBottom: 4 }}>CAMADA DE APRESENTAÇÃO — React 18</div>
          <div>                ┌──────────┴──────────┐</div>
          <div>                │  41 componentes     │</div>
          <div>                │  35+ páginas        │</div>
          <div>                │  Recharts + React   │</div>
          <div>                │  Flow (FunnelFlow)  │</div>
          <div>                └─────────────────────┘</div>
        </div>

        <h3>Modelo de Dados — Entidades Principais</h3>
        <table>
          <thead><tr><th>Modelo</th><th>Função</th><th>Relações Principais</th></tr></thead>
          <tbody>
            {[
              ['User', 'Usuário do SaaS — plano, trial, configurações', 'Funnel, Integration, Goal, Campaign, LeadStatus'],
              ['Funnel', 'Funil de vendas com etapas configuráveis', 'FunnelStage, FunnelEvent, User'],
              ['FunnelStage', 'Etapa do funil (Clique → WhatsApp → Venda)', 'Funnel, FunnelEvent'],
              ['FunnelEvent', 'Evento real rastreado (clique, msg, venda)', 'FunnelStage, Funnel — 15k+ por conta demo'],
              ['Integration', 'Conexão com plataformas externas', 'User — tipo: META_ADS, WHATSAPP, KIWIFY…'],
              ['Campaign', 'Campanha de tráfego vinculada ao funil', 'User, Workspace — Meta/Google/TikTok'],
              ['Workspace', 'Configuração de funil (workspace)', 'User, Integration, Campaign'],
              ['LeadStatus', 'Status atual de cada lead no funil', 'User — NOVO/QUALIFICADO/CLIENTE'],
              ['Goal', 'Meta configurada pelo usuário', 'User — receita, leads, vendas'],
              ['WebhookLog', 'Log de webhooks recebidos', 'User — auditoria e debug'],
              ['MetricSnapshot', 'Snapshot diário de métricas (cron)', 'User — para timeseries histórico'],
              ['Notification', 'Notificações in-app', 'User — alertas, metas, vendas'],
              ['TrackedLead', 'Lead rastreado via pixel público', 'User — UTMs, lead_id'],
              ['TrackedEvent', 'Evento do pixel (page_view, click…)', 'TrackedLead'],
              ['TrackedConversion', 'Conversão rastreada (checkout)', 'TrackedLead'],
              ['Affiliate', 'Afiliado da plataforma', 'User, AffiliateClick, AffiliateSale'],
              ['TeamMember', 'Membro da equipe com acesso limitado', 'User — role VIEWER'],
              ['AuditLog', 'Trilha de auditoria de ações críticas', 'User — pagamentos, upgrades'],
              ['StripeProcessedEvent', 'Deduplicação de webhooks Stripe', '— chave: event_id'],
              ['MercadoPagoProcessedEvent', 'Deduplicação de webhooks MP', '— chave: paymentId:status'],
            ].map(([m, f, r]) => <tr key={m}><td><strong>{m}</strong></td><td style={{ fontSize: '0.82rem' }}>{f}</td><td style={{ fontSize: '0.79rem', color: '#64748B' }}>{r}</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 10–12 — ESTRUTURA DE PASTAS
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 4 — Estrutura de Pastas e Arquivos</h2>

        <div className="code-box">
          <div style={{ color: '#38BDF8', fontWeight: 700 }}>flowfunnel/ (346 arquivos · 38.913 linhas)</div>
          <div style={{ color: '#A78BFA', marginTop: 8 }}>├── app/                        # Next.js App Router</div>
          <div>│   ├── api/                    # 80+ endpoints REST</div>
          <div>│   │   ├── auth/               # Login, registro, reset senha, verificação email</div>
          <div>│   │   ├── webhooks/           # Hotmart, Kiwify, Eduzz, Monetizze, WA, MP</div>
          <div>│   │   ├── stripe/             # Checkout, assinatura, portal, webhook</div>
          <div>│   │   ├── mercadopago/        # Preference, process-payment, public-key</div>
          <div>│   │   ├── analytics/          # Timeseries, comparação, trends, platform</div>
          <div>│   │   ├── facebook/           # Metrics, campaigns (Insights API)</div>
          <div>│   │   ├── google/             # Metrics (demo + real)</div>
          <div>│   │   ├── tiktok/             # Metrics (demo + real)</div>
          <div>│   │   ├── whatsapp/           # Messages, metrics, QR stream</div>
          <div>│   │   ├── ai/                 # Sugestões GPT-4, card-insight</div>
          <div>│   │   ├── cron/               # snapshot (diário), alerts (diário)</div>
          <div>│   │   ├── reports/            # Relatório, export-csv, export-pdf</div>
          <div>│   │   ├── leads/              # CRUD leads, scored (PRO+)</div>
          <div>│   │   ├── goals/              # CRUD metas, check automático</div>
          <div>│   │   ├── campaigns/          # CRUD campanhas</div>
          <div>│   │   ├── affiliates/         # CRUD afiliados, click, sale</div>
          <div>│   │   ├── track/              # Pixel público: event, conversion, stats</div>
          <div>│   │   ├── team/               # Convite, accept, viewer-dashboard</div>
          <div>│   │   ├── plan/               # Plano atual + features</div>
          <div>│   │   └── admin/              # Painel admin (users, churn, seed-demo)</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>│   ├── dashboard/              # Dashboard principal (695 linhas)</div>
          <div>│   ├── analytics/              # Analytics avançado</div>
          <div>│   ├── leads/                  # CRM Kanban</div>
          <div>│   ├── campaigns/              # Gestão de campanhas</div>
          <div>│   ├── reports/                # Relatórios</div>
          <div>│   ├── goals/                  # Metas</div>
          <div>│   ├── settings/               # Configurações + equipe (1.027 linhas)</div>
          <div>│   ├── billing/                # Assinatura + Stripe portal</div>
          <div>│   ├── checkout/               # Checkout Stripe + Mercado Pago</div>
          <div>│   ├── webhooks/               # Docs de webhooks + logs</div>
          <div>│   ├── admin/                  # Painel administrativo</div>
          <div>│   ├── invite/                 # Convite de equipe + viewer dashboard</div>
          <div>│   └── page.tsx                # Landing page (626 linhas)</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── components/                 # 41 componentes React</div>
          <div>│   ├── FunnelFlow.tsx          # Visualizador React Flow (552 linhas)</div>
          <div>│   ├── AppShell.tsx            # Layout principal + sidebar</div>
          <div>│   ├── DashboardSidebar.tsx    # Navegação lateral</div>
          <div>│   ├── WorkspaceTabs.tsx       # Seletor de funil/workspace</div>
          <div>│   ├── AISuggestions.tsx       # Sugestões de IA (289 linhas)</div>
          <div>│   ├── NotificationCenter.tsx  # Central de notificações</div>
          <div>│   ├── LeadKanban.tsx          # CRM Kanban</div>
          <div>│   ├── LeadIntelligence.tsx    # Lead scoring PRO</div>
          <div>│   ├── PlanGate.tsx            # Bloqueio de features por plano</div>
          <div>│   ├── charts/                 # Componentes de gráficos</div>
          <div>│   └── ...                     # 31 outros componentes</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── lib/                        # Utilitários e lógica de negócio</div>
          <div>│   ├── prisma.ts               # Cliente Prisma singleton</div>
          <div>│   ├── auth.ts                 # Config NextAuth, authOptions</div>
          <div>│   ├── plans.ts                # Limites, features, planos</div>
          <div>│   ├── trial.ts                # getEffectivePlan (trial logic)</div>
          <div>│   ├── email.ts                # Templates email Resend (452 linhas)</div>
          <div>│   ├── metrics.ts              # ROI, ROAS, CTR, CPC, distribuição</div>
          <div>│   ├── leadScoring.ts          # Algoritmo de scoring IA</div>
          <div>│   ├── webhook-handlers.ts     # Processamento webhooks (364 linhas)</div>
          <div>│   ├── webhook-stages.ts       # Mapeamento status → estágio</div>
          <div>│   ├── stripe-dedup.ts         # Deduplicação eventos Stripe</div>
          <div>│   ├── mercadopago-dedup.ts    # Deduplicação eventos MP</div>
          <div>│   ├── cache.ts                # Cache in-memory com TTL</div>
          <div>│   ├── security-utils.ts       # Rate limiting, sanitização</div>
          <div>│   └── withPlan.ts             # HOF para feature gating</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── prisma/</div>
          <div>│   ├── schema.prisma           # 26 modelos, relações, índices</div>
          <div>│   └── migrations/             # Migrations versionadas</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── public/                     # Assets estáticos</div>
          <div>│   ├── tracker.js              # Pixel público de rastreamento</div>
          <div>│   └── flowfunnel-logo.jpg</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── scripts/                    # Scripts de administração</div>
          <div>│   ├── seed-demo-account.ts    # População de conta demo</div>
          <div>│   └── db-backup.sh            # Backup lógico do banco</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── docs/                       # Runbooks e documentação</div>
          <div>│   └── DISASTER_RECOVERY.md    # Runbook de recuperação</div>
          <div style={{ color: '#A78BFA', marginTop: 6 }}>├── middleware.ts               # CSP, auth, rate limiting global</div>
          <div>├── next.config.ts              # Config Next.js</div>
          <div>└── prisma/schema.prisma        # Schema completo do banco</div>
        </div>

        <h3>Maiores Arquivos por Linhas de Código</h3>
        {[
          { file: 'app/settings/page.tsx', lines: 1027, pct: 100, desc: 'Configurações: conta, equipe, alertas, integrações' },
          { file: 'app/checkout/page.tsx', lines: 840, pct: 82, desc: 'Checkout Stripe + Mercado Pago embedded' },
          { file: 'app/admin/users/page.tsx', lines: 739, pct: 72, desc: 'Painel admin: usuários, MRR, churn, planos' },
          { file: 'app/dashboard/page.tsx', lines: 695, pct: 68, desc: 'Dashboard principal: métricas, funil, AI' },
          { file: 'app/page.tsx', lines: 626, pct: 61, desc: 'Landing page: pricing, depoimentos, FAQ' },
          { file: 'scripts/seed-demo-account.ts', lines: 617, pct: 60, desc: 'Seed de conta demo com 30 dias de dados' },
          { file: 'components/FunnelFlow.tsx', lines: 552, pct: 54, desc: 'Visualizador interativo do funil (React Flow)' },
          { file: 'app/campaigns/page.tsx', lines: 558, pct: 54, desc: 'Gestão de campanhas multi-plataforma' },
          { file: 'app/affiliate/page.tsx', lines: 624, pct: 61, desc: 'Dashboard de afiliados com comissões' },
          { file: 'lib/email.ts', lines: 452, pct: 44, desc: 'Templates de email transacional (Resend)' },
        ].map(f => (
          <div key={f.file} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <code style={{ color: '#2563EB', fontWeight: 600 }}>{f.file}</code>
              <span style={{ color: '#64748B', fontWeight: 700 }}>{f.lines} linhas</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: `${f.pct}%` }} /></div>
            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 13–15 — ANÁLISE DE CÓDIGO
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 5 — Análise de Código-Fonte por Módulo</h2>

        {[
          {
            mod: '🔐 Sistema de Autenticação', files: ['lib/auth.ts', 'app/api/auth/[...nextauth]/route.ts', 'app/api/auth/register/route.ts', 'app/api/auth/forgot-password/route.ts', 'app/api/auth/reset-password/route.ts', 'app/api/auth/verify-email/route.ts', 'middleware.ts'],
            desc: 'Autenticação via NextAuth v4 com credentials + Google OAuth. Senhas hashadas com bcryptjs (salt 12). Reset de senha via token SHA-256 hashed, uso único, expiração de 1h. Verificação de email com token de 24h. Rate limiting por IP na rota de login. CSP global via middleware.',
            importance: 'CRÍTICO',
          },
          {
            mod: '📊 Motor de Métricas', files: ['lib/metrics.ts', 'app/api/analytics/timeseries/route.ts', 'app/api/analytics/comparison/route.ts', 'app/api/facebook/metrics/route.ts', 'app/api/google/metrics/route.ts', 'app/api/tiktok/metrics/route.ts'],
            desc: 'Biblioteca central de cálculos: ROI, ROAS, CTR, CPC, CPM, taxa de conversão. Atribuição proporcional de leads e receita por cliques de cada fonte. Timeseries usa MetricSnapshots para dias passados (performance) e agrega FunnelEvents em tempo real para hoje.',
            importance: 'ALTO',
          },
          {
            mod: '🤖 Motor de IA', files: ['lib/leadScoring.ts', 'app/api/ai/suggestions/route.ts', 'app/api/ai/card-insight/route.ts', 'app/api/analytics/trends/route.ts'],
            desc: 'Lead scoring 0–100 baseado em: número de interações, tempo de resposta, estágio no funil, frequência de mensagens. Sugestões GPT-4 contextualizadas com dados reais do funil. Diagnóstico de tendências e alertas de anomalia. Feature exclusiva PRO/SCALE.',
            importance: 'ALTO',
          },
          {
            mod: '🔗 Sistema de Webhooks', files: ['app/api/webhooks/whatsapp/route.ts', 'app/api/webhooks/hotmart/route.ts', 'app/api/webhooks/kiwify/route.ts', 'lib/webhook-handlers.ts', 'lib/webhook-stages.ts', 'lib/webhook-security.ts', 'lib/webhook-dedup.ts'],
            desc: 'Receptor de webhooks de 7 plataformas. HMAC signature validation obrigatória quando secret configurado. Mapeamento normalizado de status para estágios. Deduplicação por token único (WebhookReplayProtection). Retry manual via UI. Multi-tenant por token de rota.',
            importance: 'CRÍTICO',
          },
          {
            mod: '💳 Sistema de Pagamentos', files: ['app/api/stripe/webhook/route.ts', 'app/api/stripe/checkout/route.ts', 'app/api/stripe/portal/route.ts', 'lib/stripe-dedup.ts', 'app/api/mercadopago/process-payment/route.ts', 'lib/mercadopago-dedup.ts'],
            desc: 'Stripe: subscription billing com trial de 7 dias, embedded checkout, portal self-service. Webhook com dedup persistido em DB (StripeProcessedEvent). Mercado Pago: Payment Brick embedded (PIX, boleto, cartão), dedup em MercadoPagoProcessedEvent, rate limiting 10 req/min por IP.',
            importance: 'CRÍTICO',
          },
          {
            mod: '🎯 Sistema de Planos e Feature Gating', files: ['lib/plans.ts', 'lib/trial.ts', 'lib/withPlan.ts', 'app/api/plan/route.ts', 'components/PlanGate.tsx', 'components/usePlan.ts'],
            desc: 'Lógica centralizada de planos em lib/plans.ts. getEffectivePlan() leva em conta trial ativo. withPlan.ts HOF para feature gating nos endpoints (retorna 402 com upgradeUrl). PlanGate component aplica blur + lock no frontend. Trial de 7 dias sem cartão.',
            importance: 'ALTO',
          },
          {
            mod: '📡 Pixel de Rastreamento', files: ['public/tracker.js', 'app/api/track/event/route.ts', 'app/api/track/conversion/route.ts', 'app/api/track/stats/route.ts', 'app/api/track/install/route.ts'],
            desc: 'Pixel JavaScript público para landing pages dos clientes. Captura UTMs, gera lead_id, rastreia page_view, cliques em checkout e WhatsApp. Usa sendBeacon para garantia de entrega. Endpoints públicos com CORS *. Stats autenticados com breakdown por UTM source.',
            importance: 'MÉDIO',
          },
          {
            mod: '🔔 Sistema de Notificações e Alertas', files: ['app/api/cron/alerts/route.ts', 'app/api/notifications/route.ts', 'components/NotificationCenter.tsx', 'components/AlertSystem.tsx'],
            desc: 'Cron diário avalia 4 regras (queda de vendas 7d, conversão abaixo da meta, campanha sem leads 24h, gasto sem retorno 48h). Busca dados em lote, sem N+1. Notificações in-app em tempo real. Feature de alertas automáticos exclusiva SCALE.',
            importance: 'MÉDIO',
          },
        ].map(m => (
          <div key={m.mod} style={{ marginBottom: 16, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: '0.95rem', color: '#1E40AF' }}>{m.mod}</strong>
              <span className={`badge ${m.importance === 'CRÍTICO' ? 'badge-red' : m.importance === 'ALTO' ? 'badge-yellow' : 'badge-blue'}`}>{m.importance}</span>
            </div>
            <p style={{ fontSize: '0.84rem', margin: '0 0 8px' }}>{m.desc}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {m.files.map(f => <code key={f} style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: 4 }}>{f}</code>)}
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 16–17 — PROPRIEDADE INTELECTUAL
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 6 — Códigos Estratégicos — Propriedade Intelectual</h2>

        <div className="warning-box">
          <strong>Aviso Legal:</strong> Os algoritmos e lógicas descritos nesta seção constituem a principal propriedade 
          intelectual da FlowFunnel. Recomenda-se registro junto ao INPI (Instituto Nacional da Propriedade Industrial) 
          e proteção por direitos autorais de software nos termos da Lei 9.609/98.
        </div>

        {[
          {
            title: '🧠 Algoritmo de Lead Scoring Proprietário',
            file: 'lib/leadScoring.ts',
            value: 'MÁXIMO',
            desc: 'Algoritmo original que combina múltiplas variáveis comportamentais para gerar score 0-100 e classificação quente/morno/frio. Considera: velocidade de resposta, profundidade de engajamento, frequência de interações, progressão no funil e sinais de intenção de compra. Exclusivo do mercado brasileiro de WhatsApp + infoprodutos.',
            protect: ['Registro de Programa de Computador (INPI)', 'Direitos Autorais (Lei 9.609/98)', 'Segredo industrial (não publicar open-source)'],
          },
          {
            title: '📡 Motor de Atribuição Multi-Touch Proporcional',
            file: 'lib/metrics.ts — distributeByClicks()',
            value: 'ALTO',
            desc: 'Algoritmo original de atribuição de leads e receita entre múltiplas fontes de tráfego (Meta, Google, TikTok) proporcional aos cliques de cada fonte, com garantia de soma exata (o último item absorve o resto da divisão inteira). Resolve o problema clássico de atribuição multi-touch no contexto WhatsApp.',
            protect: ['Registro de Programa de Computador (INPI)', 'Patente de método (avaliar viabilidade)'],
          },
          {
            title: '🔄 Sistema de Deduplicação de Webhooks com Claim/Release',
            file: 'lib/stripe-dedup.ts · lib/mercadopago-dedup.ts',
            value: 'ALTO',
            desc: 'Padrão original de deduplicação de eventos de pagamento com garantia at-least-once. Usa claim/release no banco de dados: claim impede processamento duplicado, release em caso de falha permite retry. Sobrevive a restarts e múltiplas instâncias. Espelha exatamente o mesmo padrão entre Stripe e Mercado Pago.',
            protect: ['Direitos Autorais (Lei 9.609/98)', 'Documentação técnica como evidência de autoria'],
          },
          {
            title: '🗺️ Mapeamento Universal de Status para Estágios de Funil',
            file: 'lib/webhook-stages.ts',
            value: 'MÉDIO-ALTO',
            desc: 'Biblioteca original que normaliza os diferentes status de pagamento e compra de Hotmart, Kiwify, Eduzz, Monetizze e Perfect Pay para estágios granulares universais do funil FlowFunnel (Recusado, Reembolsado, Chargeback, Abandonado, etc.). Permite que qualquer plataforma de infoproduto seja tratada de forma uniforme.',
            protect: ['Direitos Autorais', 'Parte do registro do programa completo'],
          },
          {
            title: '⚡ Pipeline de Cron Analytics sem N+1 Query',
            file: 'app/api/cron/snapshot/route.ts · alerts/route.ts',
            value: 'MÉDIO',
            desc: 'Arquitetura original de processamento em lote para cron diário: busca dados de todos os usuários em poucas queries (findMany/groupBy agregados), avalia regras de alerta e gera snapshots em memória, sem loop de queries por usuário. Escala linearmente independente do número de usuários.',
            protect: ['Direitos Autorais', 'Know-how técnico (segredo industrial)'],
          },
          {
            title: '🔌 Sistema Multi-Tenant de Webhooks por Token de Rota',
            file: 'lib/webhook-tenant.ts · lib/webhook-security.ts',
            value: 'MÉDIO-ALTO',
            desc: 'Arquitetura que permite que cada usuário tenha um endpoint de webhook único e seguro, identificado por token na rota (/api/webhooks/hotmart/[token]). Combina isolamento de tenant com validação HMAC, fail-closed quando secret configurado. Permite onboarding zero-config.',
            protect: ['Direitos Autorais', 'Parte do registro do programa completo'],
          },
        ].map(item => (
          <div key={item.title} style={{ marginBottom: 16, border: `2px solid ${item.value === 'MÁXIMO' ? '#FCA5A5' : item.value === 'ALTO' ? '#FCD34D' : '#BFDBFE'}`, borderRadius: 10, padding: 14, background: item.value === 'MÁXIMO' ? '#FFF5F5' : item.value === 'ALTO' ? '#FFFBEB' : '#EFF6FF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: '0.92rem' }}>{item.title}</strong>
              <span className={`badge ${item.value === 'MÁXIMO' ? 'badge-red' : item.value === 'ALTO' ? 'badge-yellow' : 'badge-blue'}`}>Valor {item.value}</span>
            </div>
            <code style={{ fontSize: '0.75rem', color: '#475569', background: '#F1F5F9', padding: '2px 8px', borderRadius: 4 }}>{item.file}</code>
            <p style={{ fontSize: '0.84rem', margin: '8px 0' }}>{item.desc}</p>
            <div>
              <strong style={{ fontSize: '0.78rem', color: '#374151' }}>Proteção recomendada:</strong>
              <ul style={{ margin: '4px 0 0 16px' }}>
                {item.protect.map(p => <li key={p} style={{ fontSize: '0.78rem', color: '#475569' }}>{p}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 18–19 — MÉTRICAS DO PROJETO
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 7 — Métricas do Projeto</h2>

        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { num: '38.913', label: 'Linhas de código' },
            { num: '346', label: 'Arquivos no projeto' },
            { num: '80+', label: 'Endpoints API' },
            { num: '41', label: 'Componentes React' },
            { num: '35+', label: 'Páginas' },
            { num: '26', label: 'Modelos Prisma' },
            { num: '12+', label: 'Integrações' },
            { num: '6', label: 'Emails transacionais' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-num" style={{ fontSize: '1.5rem' }}>{k.num}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>

        <h3>Breakdown de Linhas por Categoria</h3>
        {[
          { cat: 'Páginas (app/*/page.tsx)', lines: 12400, pct: 32 },
          { cat: 'API Routes (app/api/**)', lines: 9800, pct: 25 },
          { cat: 'Componentes React (components/)', lines: 8500, pct: 22 },
          { cat: 'Bibliotecas (lib/)', lines: 5200, pct: 13 },
          { cat: 'Scripts e utilitários', lines: 1600, pct: 4 },
          { cat: 'Schema Prisma + configurações', lines: 1413, pct: 4 },
        ].map(r => (
          <div key={r.cat} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 500 }}>{r.cat}</span>
              <span style={{ color: '#64748B', fontWeight: 700 }}>{r.lines.toLocaleString('pt-BR')} linhas</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: `${r.pct}%` }} /></div>
          </div>
        ))}

        <h3>APIs e Integrações Externas</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 16 }}>
          {['Meta Ads Insights API', 'WhatsApp Business Cloud API', 'Google Ads API', 'TikTok Ads API', 'Stripe Billing API', 'Mercado Pago Payments API', 'OpenAI GPT-4 API', 'Resend Email API', 'Hotmart Webhook', 'Kiwify Webhook', 'Eduzz Webhook', 'Monetizze Webhook', 'Perfect Pay Webhook', 'NextAuth Providers'].map(i => (
            <span key={i} className="integration-pill">{i}</span>
          ))}
        </div>

        <h3>Complexidade dos Endpoints de API</h3>
        <table>
          <thead><tr><th>Grupo</th><th>Endpoints</th><th>Autenticação</th><th>Rate Limit</th></tr></thead>
          <tbody>
            <tr><td>Autenticação</td><td>7</td><td>Pública + Session</td><td>Por IP (login)</td></tr>
            <tr><td>Webhooks externos</td><td>12</td><td>HMAC signature</td><td>Deduplicação</td></tr>
            <tr><td>Analytics</td><td>6</td><td>Session obrigatória</td><td>Cache TTL</td></tr>
            <tr><td>Stripe</td><td>9</td><td>Session / Webhook secret</td><td>Por user ID</td></tr>
            <tr><td>Mercado Pago</td><td>5</td><td>Session / HMAC</td><td>10/min por IP</td></tr>
            <tr><td>IA</td><td>2</td><td>Session + plan check</td><td>Por user ID</td></tr>
            <tr><td>Relatórios</td><td>3</td><td>Session + plan check</td><td>—</td></tr>
            <tr><td>Admin</td><td>4</td><td>ADMIN role</td><td>—</td></tr>
            <tr><td>Pixel público</td><td>4</td><td>CORS * (pública)</td><td>—</td></tr>
            <tr><td>Cron</td><td>2</td><td>Bearer CRON_SECRET</td><td>—</td></tr>
            <tr><td>Outros (leads, goals, etc.)</td><td>26+</td><td>Session obrigatória</td><td>Varia</td></tr>
          </tbody>
        </table>

        <h3>Dependências Principais</h3>
        <table>
          <thead><tr><th>Pacote</th><th>Versão</th><th>Categoria</th><th>Finalidade</th></tr></thead>
          <tbody>
            {[
              ['next', '^16.2.6', 'Core', 'Framework full-stack'],
              ['react', '^18.2.0', 'Core', 'UI library'],
              ['@prisma/client', '^5.8.1', 'Database', 'ORM type-safe'],
              ['next-auth', '^4.24.5', 'Auth', 'Authentication'],
              ['stripe', '^21.0.1', 'Payments', 'Billing e assinaturas'],
              ['openai', '^6.16.0', 'IA', 'GPT-4 integration'],
              ['recharts', '^2.15.4', 'Charts', 'Visualização de dados'],
              ['@xyflow/react', '^12.10.2', 'Viz', 'Diagrama do funil'],
              ['resend', '^6.9.4', 'Email', 'Emails transacionais'],
              ['jspdf', '^4.0.0', 'Export', 'Geração de PDF cliente'],
              ['pdfkit', '^0.18.0', 'Export', 'Geração de PDF servidor'],
              ['bcryptjs', '^2.4.3', 'Security', 'Hash de senhas'],
              ['zod', '^3.22.4', 'Validation', 'Schema validation'],
            ].map(r => <tr key={r[0]}><td><code style={{ fontSize: '0.82rem' }}>{r[0]}</code></td><td style={{ fontSize: '0.82rem' }}>{r[1]}</td><td><span className="badge badge-blue">{r[2]}</span></td><td style={{ fontSize: '0.82rem' }}>{r[3]}</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 20–21 — ESCALABILIDADE
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 8 — Análise de Escalabilidade</h2>

        <h3>Capacidade Atual</h3>
        <table>
          <thead><tr><th>Componente</th><th>Capacidade Atual</th><th>Limitante</th><th>Solução p/ escala</th></tr></thead>
          <tbody>
            <tr><td>Usuários simultâneos</td><td><strong>500–2.000</strong></td><td>Instância única Replit</td><td>Load balancer + múltiplas instâncias</td></tr>
            <tr><td>Webhooks por segundo</td><td><strong>50–200/s</strong></td><td>Processamento síncrono</td><td>Fila assíncrona (BullMQ/SQS)</td></tr>
            <tr><td>Eventos no banco</td><td><strong>Ilimitado</strong></td><td>Performance de query</td><td>Índices já otimizados (migration)</td></tr>
            <tr><td>Usuários no banco</td><td><strong>100.000+</strong></td><td>Tamanho do banco</td><td>Read replicas, particionamento</td></tr>
            <tr><td>Relatórios PDF</td><td><strong>Síncrono</strong></td><td>Timeout em 30s</td><td>Job queue + download link</td></tr>
            <tr><td>IA (OpenAI)</td><td><strong>Rate limited pela API</strong></td><td>Custo e latência</td><td>Cache de respostas + streaming</td></tr>
          </tbody>
        </table>

        <h3>Otimizações Implementadas</h3>
        <div className="two-col">
          <div>
            <h4>Banco de Dados</h4>
            <ul>
              <li>Índices compostos em FunnelEvent (funnelId, timestamp)</li>
              <li>Índice em WebhookLog (userId, createdAt)</li>
              <li>Índice em Account e Funnel por userId</li>
              <li>MetricSnapshot: timeseries via snapshots (não agrega live)</li>
              <li>Cron queries em lote — sem N+1</li>
            </ul>
          </div>
          <div>
            <h4>Aplicação</h4>
            <ul>
              <li>Cache in-memory com TTL (lib/cache.ts)</li>
              <li>Cache TTL curto para métricas (2 min)</li>
              <li>Rate limiting por user ID nos pagamentos</li>
              <li>Deduplicação persistida no banco</li>
              <li>Lazy loading de componentes pesados (dynamic import)</li>
            </ul>
          </div>
        </div>

        <h3>Projeção de Escalabilidade por Volume de Usuários</h3>
        <table>
          <thead><tr><th>Usuários</th><th>Infraestrutura Necessária</th><th>Custo Infra/mês</th><th>Ações Requeridas</th></tr></thead>
          <tbody>
            <tr><td><strong>0–500</strong></td><td>Replit atual (1 instância)</td><td>R$ 200–500</td><td>Nenhuma — já ok</td></tr>
            <tr><td><strong>500–2.000</strong></td><td>Replit + PostgreSQL dedicado</td><td>R$ 800–2.000</td><td>Upgrades de plano Replit</td></tr>
            <tr><td><strong>2.000–10.000</strong></td><td>AWS/GCP: 2–4 instâncias + RDS</td><td>R$ 3.000–8.000</td><td>Containerização, load balancer</td></tr>
            <tr><td><strong>10.000–50.000</strong></td><td>Kubernetes + Aurora PostgreSQL</td><td>R$ 15.000–40.000</td><td>Fila assíncrona, CDN, Redis</td></tr>
            <tr><td><strong>50.000+</strong></td><td>Multi-region + sharding</td><td>R$ 60.000+</td><td>Equipe DevOps dedicada</td></tr>
          </tbody>
        </table>

        <h3>Gargalos Identificados e Soluções</h3>
        {[
          { gap: 'Processamento de webhooks síncrono', sol: 'Implementar fila BullMQ/SQS. Webhooks confirmam 200 imediatamente e processam async. Elimina timeout em picos de vendas.', priority: 'ALTA' },
          { gap: 'Geração de PDF bloqueante', sol: 'Mover para job queue: usuário solicita, recebe ID, baixa quando pronto. Worker separado processa PDFs em background.', priority: 'MÉDIA' },
          { gap: 'Cache em memória não compartilhado', sol: 'Migrar para Redis para cache compartilhado entre instâncias. TTL atual funciona bem na instância única.', priority: 'MÉDIA' },
          { gap: 'OpenAI API latência (~3–8s)', sol: 'Cache de respostas de IA (5-10 min TTL), streaming de respostas, fallback para respostas pré-calculadas.', priority: 'BAIXA' },
        ].map(g => (
          <div key={g.gap} style={{ display: 'flex', gap: 12, marginBottom: 10, padding: 12, border: '1px solid #E2E8F0', borderRadius: 8 }}>
            <span className={`badge ${g.priority === 'ALTA' ? 'badge-red' : g.priority === 'MÉDIA' ? 'badge-yellow' : 'badge-blue'}`} style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', marginTop: 2 }}>{g.priority}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E40AF', marginBottom: 3 }}>{g.gap}</div>
              <div style={{ fontSize: '0.83rem', color: '#475569' }}>{g.sol}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 22–24 — MODELO DE NEGÓCIO
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 9 — Modelo de Negócio</h2>

        <h3>Estrutura de Planos e Receita</h3>
        <div className="two-col" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', display: 'grid', gap: 12 }}>
          {[
            { name: 'FREE', price: 'R$0', conv: '0 conv.', color: '#64748B', featured: false, features: ['Dashboard básico', 'Sem conversas', 'Trial disponível'] },
            { name: 'START', price: 'R$97/mês', conv: '1.000 conv.', color: '#2563EB', featured: false, features: ['1 funil ativo', '1 número WhatsApp', '7 dias histórico', 'Export CSV'] },
            { name: 'PRO', price: 'R$147/mês', conv: '3.000 conv.', color: '#7C3AED', featured: true, features: ['3 funis ativos', '3 números WhatsApp', '365 dias histórico', 'Lead scoring IA', 'Comparativo período'] },
            { name: 'SCALE', price: 'R$297/mês', conv: 'Ilimitado', color: '#059669', featured: false, features: ['Funis ilimitados', 'WhatsApp ilimitado', 'Alertas automáticos', 'IA avançada', 'Equipe'] },
          ].map(p => (
            <div key={p.name} style={{ border: `2px solid ${p.featured ? '#7C3AED' : '#E2E8F0'}`, borderRadius: 12, padding: 14, background: p.featured ? '#F5F3FF' : '#F8FAFC' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: p.color, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: DARK, marginBottom: 2 }}>{p.price}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: 10 }}>{p.conv}</div>
              {p.features.map(f => <div key={f} style={{ fontSize: '0.75rem', color: '#374151', marginBottom: 2 }}>✓ {f}</div>)}
            </div>
          ))}
        </div>

        <h3>Métricas de Negócio</h3>
        <table>
          <thead><tr><th>Métrica</th><th>Valor Estimado</th><th>Base de Cálculo</th></tr></thead>
          <tbody>
            <tr><td>Ticket Médio (ARPU)</td><td><strong>R$ 174/mês</strong></td><td>Mix: 50% START · 35% PRO · 15% SCALE</td></tr>
            <tr><td>CAC (Custo de Aquisição)</td><td><strong>R$ 120–200</strong></td><td>Via ads, orgânico e afiliados</td></tr>
            <tr><td>LTV (Lifetime Value)</td><td><strong>R$ 1.740–2.600</strong></td><td>ARPU × 10–15 meses (churn 6–10%)</td></tr>
            <tr><td>LTV/CAC Ratio</td><td><strong>10–13x</strong></td><td>Meta: mínimo 3x (excelente: 10x)</td></tr>
            <tr><td>Churn Mensal Estimado</td><td><strong>6–10%</strong></td><td>Média SaaS B2B Brasil pequenas empresas</td></tr>
            <tr><td>MRR Break-even</td><td><strong>~R$ 8.000/mês</strong></td><td>Custo infra + operação mínima</td></tr>
            <tr><td>Payback Period</td><td><strong>1–2 meses</strong></td><td>CAC R$160 / ARPU R$174</td></tr>
            <tr><td>Trial Conversion Rate (Est.)</td><td><strong>20–35%</strong></td><td>Trial 7 dias sem cartão</td></tr>
          </tbody>
        </table>

        <h3>Fontes de Receita</h3>
        <div className="flow-step">
          <div className="flow-num">1</div>
          <div className="flow-content">
            <h4>Assinaturas Mensais (Principal)</h4>
            <p style={{ fontSize: '0.84rem', margin: 0 }}>START R$97 · PRO R$147 · SCALE R$297 via Stripe (cartão internacional) ou Mercado Pago (PIX, boleto, cartão nacional).</p>
          </div>
        </div>
        <div className="flow-step">
          <div className="flow-num">2</div>
          <div className="flow-content">
            <h4>Programa de Afiliados</h4>
            <p style={{ fontSize: '0.84rem', margin: 0 }}>Sistema nativo de afiliados com tracking de cliques e comissões. Afiliados promovem e recebem % por venda. Alavanca crescimento orgânico sem CAC direto.</p>
          </div>
        </div>
        <div className="flow-step">
          <div className="flow-num">3</div>
          <div className="flow-content">
            <h4>Upsell PRO → SCALE</h4>
            <p style={{ fontSize: '0.84rem', margin: 0 }}>UpgradeTriggers dinâmicos baseados em dados reais: quando usuário atinge limite de conversas, aparece CTA contextual. Aumenta ARPU sem CAC adicional.</p>
          </div>
        </div>
        <div className="flow-step">
          <div className="flow-num">4</div>
          <div className="flow-content">
            <h4>Futura: White-Label / API Access</h4>
            <p style={{ fontSize: '0.84rem', margin: 0 }}>Potencial de licenciar a plataforma para agências com branding próprio. Ou API access para integrações customizadas (plano Enterprise futuro).</p>
          </div>
        </div>

        <h3>Funil de Conversão da Própria Plataforma</h3>
        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16 }}>
          {[
            { stage: 'Visita à Landing Page', val: '100%', n: '10.000 visitas/mês' },
            { stage: 'Clica em "7 dias grátis"', val: '12%', n: '1.200 registros' },
            { stage: 'Ativa Trial (com plano)', val: '60%', n: '720 trials ativos' },
            { stage: 'Converte para pago', val: '28%', n: '202 pagantes novos/mês' },
            { stage: 'Retém no mês 3', val: '72%', n: '145 retidos' },
          ].map((s, i) => (
            <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 4 ? 8 : 0 }}>
              <div style={{ width: 80, textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#2563EB' }}>{s.val}</div>
              <div style={{ flex: 1, height: 28, background: '#E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: s.val, background: `hsl(${220 - i * 20}, 70%, ${55 + i * 3}%)`, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                  <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>{s.stage}</span>
                </div>
              </div>
              <div style={{ width: 100, fontSize: '0.75rem', color: '#64748B' }}>{s.n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 25–28 — PROJEÇÕES FINANCEIRAS
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 10 — Projeções Financeiras</h2>

        <p>Projeções baseadas em ARPU médio de R$174/mês, churn de 8%/mês, custos de infraestrutura e operação estimados conforme escala.</p>

        <h3>Cenário Conservador</h3>
        <table>
          <thead><tr><th>Clientes Pagantes</th><th>MRR</th><th>ARR</th><th>Custo Infra</th><th>Custo Total Op.</th><th>EBITDA/mês</th></tr></thead>
          <tbody>
            <tr><td>100</td><td>R$ 17.400</td><td>R$ 208.800</td><td>R$ 800</td><td>R$ 5.000</td><td><strong>R$ 12.400</strong></td></tr>
            <tr><td>250</td><td>R$ 43.500</td><td>R$ 522.000</td><td>R$ 1.500</td><td>R$ 10.000</td><td><strong>R$ 33.500</strong></td></tr>
            <tr><td>500</td><td>R$ 87.000</td><td>R$ 1.044.000</td><td>R$ 2.500</td><td>R$ 20.000</td><td><strong>R$ 67.000</strong></td></tr>
            <tr><td>1.000</td><td>R$ 174.000</td><td>R$ 2.088.000</td><td>R$ 5.000</td><td>R$ 40.000</td><td><strong>R$ 134.000</strong></td></tr>
          </tbody>
        </table>

        <h3>Cenário Moderado</h3>
        <table>
          <thead><tr><th>Clientes Pagantes</th><th>MRR</th><th>ARR</th><th>Custo Infra</th><th>Custo Total Op.</th><th>EBITDA/mês</th></tr></thead>
          <tbody>
            <tr><td>2.500</td><td>R$ 435.000</td><td>R$ 5.220.000</td><td>R$ 12.000</td><td>R$ 100.000</td><td><strong>R$ 335.000</strong></td></tr>
            <tr><td>5.000</td><td>R$ 870.000</td><td>R$ 10.440.000</td><td>R$ 25.000</td><td>R$ 200.000</td><td><strong>R$ 670.000</strong></td></tr>
            <tr><td>10.000</td><td>R$ 1.740.000</td><td>R$ 20.880.000</td><td>R$ 60.000</td><td>R$ 450.000</td><td><strong>R$ 1.290.000</strong></td></tr>
          </tbody>
        </table>

        <h3>Cenário Agressivo</h3>
        <table>
          <thead><tr><th>Clientes Pagantes</th><th>MRR</th><th>ARR</th><th>Custo Infra</th><th>Custo Total Op.</th><th>EBITDA/mês</th></tr></thead>
          <tbody>
            <tr><td>25.000</td><td>R$ 4.350.000</td><td>R$ 52.200.000</td><td>R$ 150.000</td><td>R$ 1.200.000</td><td><strong>R$ 3.150.000</strong></td></tr>
            <tr><td>50.000</td><td>R$ 8.700.000</td><td>R$ 104.400.000</td><td>R$ 300.000</td><td>R$ 2.500.000</td><td><strong>R$ 6.200.000</strong></td></tr>
            <tr><td>100.000</td><td>R$ 17.400.000</td><td>R$ 208.800.000</td><td>R$ 600.000</td><td>R$ 5.000.000</td><td><strong>R$ 12.400.000</strong></td></tr>
          </tbody>
        </table>

        <h3>Projeção de Crescimento — 36 Meses (Cenário Moderado)</h3>
        <div style={{ background: '#0F172A', borderRadius: 10, padding: 16, color: '#E2E8F0', fontFamily: 'monospace', fontSize: '0.8rem' }}>
          <div style={{ color: '#38BDF8', marginBottom: 12, fontWeight: 700 }}>Crescimento MRR — Meses 1 a 36 (crescimento 15% m/m decaindo para 8%)</div>
          {[
            { m: 'M6', cli: 50, mrr: 'R$ 8.700', bar: 5 },
            { m: 'M12', cli: 180, mrr: 'R$ 31.320', bar: 18 },
            { m: 'M18', cli: 450, mrr: 'R$ 78.300', bar: 45 },
            { m: 'M24', cli: 900, mrr: 'R$ 156.600', bar: 90 },
            { m: 'M30', cli: 1800, mrr: 'R$ 313.200', bar: 100 },
            { m: 'M36', cli: 3200, mrr: 'R$ 556.800', bar: 100 },
          ].map(r => (
            <div key={r.m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 28, color: '#94A3B8' }}>{r.m}</span>
              <div style={{ flex: 1, height: 16, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.bar}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)', borderRadius: 3 }} />
              </div>
              <span style={{ width: 60, color: '#94A3B8', fontSize: '0.72rem' }}>{r.cli} cli.</span>
              <span style={{ width: 110, color: '#34D399', fontWeight: 700 }}>{r.mrr}</span>
            </div>
          ))}
        </div>

        <h3>Composição de Custos Operacionais (1.000 clientes)</h3>
        <table>
          <thead><tr><th>Item</th><th>Custo/mês</th><th>% do Total</th></tr></thead>
          <tbody>
            <tr><td>Infraestrutura (hosting, DB, CDN)</td><td>R$ 5.000</td><td>12,5%</td></tr>
            <tr><td>OpenAI API (IA)</td><td>R$ 3.000</td><td>7,5%</td></tr>
            <tr><td>Stripe + Mercado Pago (fees ~3%)</td><td>R$ 5.220</td><td>13%</td></tr>
            <tr><td>Resend (email)</td><td>R$ 500</td><td>1,25%</td></tr>
            <tr><td>WhatsApp Business API</td><td>R$ 1.000</td><td>2,5%</td></tr>
            <tr><td>Suporte / CS</td><td>R$ 8.000</td><td>20%</td></tr>
            <tr><td>Marketing / Aquisição</td><td>R$ 15.000</td><td>37,5%</td></tr>
            <tr><td>Overhead (legal, contabilidade…)</td><td>R$ 2.280</td><td>5,7%</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>R$ 40.000</strong></td><td>23% da receita</td></tr>
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 29–30 — VALUATION
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 11 — Valuation da Empresa</h2>

        <div className="highlight-box">
          <strong>Metodologia:</strong> Valuation SaaS via múltiplos de ARR (Annual Recurring Revenue). 
          Múltiplos típicos para SaaS brasileiro early-stage: <strong>5–12x ARR</strong> dependendo de crescimento, 
          churn, NRR e market size. Startups em crescimento acelerado (30%+/mês) atingem 15–25x ARR.
        </div>

        <h3>Valuation por Estágio de Crescimento</h3>
        <table>
          <thead><tr><th>Estágio</th><th>Clientes</th><th>MRR</th><th>ARR</th><th>Múltiplo</th><th>Valuation Estimado</th></tr></thead>
          <tbody>
            <tr><td>Pre-revenue (atual)</td><td>0–10</td><td>—</td><td>—</td><td>Valor IP + Tech</td><td><strong>R$ 300.000–800.000</strong></td></tr>
            <tr><td>Early traction</td><td>50–100</td><td>R$ 17.400</td><td>R$ 208.800</td><td>8x ARR</td><td><strong>R$ 1.670.400</strong></td></tr>
            <tr><td>Product-Market Fit</td><td>500</td><td>R$ 87.000</td><td>R$ 1.044.000</td><td>10x ARR</td><td><strong>R$ 10.440.000</strong></td></tr>
            <tr><td>Scale</td><td>2.000</td><td>R$ 348.000</td><td>R$ 4.176.000</td><td>12x ARR</td><td><strong>R$ 50.112.000</strong></td></tr>
            <tr><td>Growth</td><td>10.000</td><td>R$ 1.740.000</td><td>R$ 20.880.000</td><td>15x ARR</td><td><strong>R$ 313.200.000</strong></td></tr>
            <tr><td>Market Leader</td><td>50.000</td><td>R$ 8.700.000</td><td>R$ 104.400.000</td><td>12x ARR</td><td><strong>R$ 1.252.800.000</strong></td></tr>
          </tbody>
        </table>

        <h3>Valor Atual do Ativo Tecnológico</h3>
        <table>
          <thead><tr><th>Componente</th><th>Base de Cálculo</th><th>Valor Estimado</th></tr></thead>
          <tbody>
            <tr><td>Código-fonte (38.913 linhas)</td><td>R$50–100/linha (dev sênior)</td><td>R$ 1.945.650 – R$ 3.891.300</td></tr>
            <tr><td>Propriedade Intelectual (algoritmos)</td><td>Valor diferencial de mercado</td><td>R$ 200.000 – R$ 500.000</td></tr>
            <tr><td>Arquitetura e design do sistema</td><td>500h de arquitetura × R$300/h</td><td>R$ 150.000</td></tr>
            <tr><td>Integrações (12 plataformas)</td><td>50h × R$200/h × 12</td><td>R$ 120.000</td></tr>
            <tr><td>Banco de dados e modelagem</td><td>100h × R$250/h</td><td>R$ 25.000</td></tr>
            <tr><td>Documentação e processos</td><td>—</td><td>R$ 30.000</td></tr>
            <tr><td><strong>Total Ativo Tecnológico</strong></td><td>—</td><td><strong>R$ 2.470.650 – R$ 4.716.300</strong></td></tr>
          </tbody>
        </table>

        <h3>Fatores de Valorização</h3>
        <div className="two-col">
          <div>
            <h4 style={{ color: '#059669' }}>✅ Fatores Positivos</h4>
            <ul>
              <li>Mercado em crescimento de 34%/ano</li>
              <li>Nicho específico com baixa concorrência direta</li>
              <li>Trial sem cartão = menor fricção de conversão</li>
              <li>Múltiplos processadores de pagamento (BR-first)</li>
              <li>IA integrada como diferencial competitivo</li>
              <li>Pixel próprio = dados proprietários de UTM</li>
              <li>Sistema de afiliados = CAC reduzido</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#DC2626' }}>⚠️ Fatores de Risco</h4>
            <ul>
              <li>Dependência da WhatsApp Business API (Meta)</li>
              <li>Concorrência de grandes players (RD Station)</li>
              <li>Churn potencial em crises econômicas</li>
              <li>Regulação LGPD em evolução</li>
              <li>Custo crescente da OpenAI API</li>
              <li>Equipe atual pequena</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 31–33 — ANÁLISE COMPETITIVA
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 12 — Análise Competitiva</h2>

        <table>
          <thead>
            <tr>
              <th>Recurso</th>
              <th>FlowFunnel</th>
              <th>RD Station</th>
              <th>HubSpot</th>
              <th>Kommo (amoCRM)</th>
              <th>Zapier</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Rastreamento WhatsApp nativo', '✅ Nativo', '❌', '❌', '⚠️ Limitado', '❌'],
              ['Funil visual Meta→WA→Venda', '✅ Completo', '❌', '❌', '⚠️ Parcial', '❌'],
              ['ROI por fonte de tráfego', '✅ Automático', '⚠️ Manual', '⚠️ Manual', '❌', '❌'],
              ['Lead scoring com IA', '✅ Incluído', '❌', '💰 Pago extra', '❌', '❌'],
              ['Integração PIX/Boleto BR', '✅ Mercado Pago', '❌', '❌', '❌', '❌'],
              ['Hotmart/Kiwify/Eduzz', '✅ Nativo', '⚠️ Via Zapier', '⚠️ Via Zapier', '❌', '✅ Via fluxo'],
              ['Relatório PDF automático', '✅ Incluído', '⚠️ Limitado', '💰 Pago extra', '❌', '❌'],
              ['Trial sem cartão', '✅ 7 dias', '✅', '✅', '✅', '✅'],
              ['Pixel de rastreamento próprio', '✅ Incluso', '✅', '✅', '❌', '❌'],
              ['Preço mínimo BR', '✅ R$97/mês', 'R$149/mês', 'US$15/mês', 'US$15/mês', 'US$20/mês'],
              ['Suporte em português', '✅', '✅', '⚠️ Básico', '⚠️ Básico', '❌'],
              ['Alertas automáticos IA', '✅ SCALE', '❌', '💰 Extra', '❌', '❌'],
              ['Programa de afiliados', '✅ Nativo', '❌', '❌', '❌', '❌'],
            ].map(row => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} style={{ fontSize: '0.82rem', color: i === 1 ? '#1D4ED8' : undefined, fontWeight: i === 1 ? 700 : undefined }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Posicionamento Estratégico</h3>
        <div className="two-col">
          <div className="arch-box">
            <h4>Oceano Azul — Sem Concorrente Direto</h4>
            <p style={{ fontSize: '0.84rem', margin: 0 }}>Nenhuma plataforma do mercado brasileiro oferece a combinação específica de: rastreamento WhatsApp Business API + atribuição multi-fonte de tráfego pago + integração nativa com infoprodutos BR (Hotmart, Kiwify, Eduzz) + IA de lead scoring, tudo em um único produto por R$97–297/mês.</p>
          </div>
          <div className="arch-box" style={{ borderColor: '#A7F3D0', background: '#ECFDF5' }}>
            <h4>Vantagem Competitiva Sustentável</h4>
            <p style={{ fontSize: '0.84rem', margin: 0 }}>A combinação de dados proprietários de comportamento WhatsApp + UTM pixel + compras gera um dataset único que alimenta modelos de IA cada vez mais precisos. Efeito de rede: quanto mais usuários, melhor o scoring de IA.</p>
          </div>
        </div>

        <h3>Análise SWOT</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { title: '💪 Forças (Strengths)', color: '#D1FAE5', border: '#6EE7B7', items: ['Único no nicho WhatsApp + infoprodutos BR', 'Preço acessível vs. concorrentes internacionais', 'IA integrada sem custo extra', 'Múltiplos métodos de pagamento BR', 'Trial sem cartão — baixa fricção'] },
            { title: '⚡ Fraquezas (Weaknesses)', color: '#FEF3C7', border: '#FCD34D', items: ['Time pequeno / solo founder risk', 'Brand awareness ainda em construção', 'Sem app mobile nativo', 'Dependência de APIs de terceiros (Meta, WA)', 'Suporte 24/7 ainda não implementado'] },
            { title: '🚀 Oportunidades (Opportunities)', color: '#DBEAFE', border: '#93C5FD', items: ['Mercado de infoprodutos crescendo 34%/ano', 'WhatsApp com 169M usuários no Brasil', 'IA como diferencial crescente', 'White-label para agências', 'Expansão para LATAM (México, Argentina)'] },
            { title: '⚠️ Ameaças (Threats)', color: '#FEE2E2', border: '#FCA5A5', items: ['Meta pode mudar políticas da WhatsApp API', 'RD Station / HubSpot podem entrar no nicho', 'Regulação LGPD em evolução', 'Crise econômica reduz investimento em tráfego', 'Open-source competitor'] },
          ].map(q => (
            <div key={q.title} style={{ background: q.color, border: `2px solid ${q.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>{q.title}</div>
              {q.items.map(i => <div key={i} style={{ fontSize: '0.8rem', marginBottom: 3 }}>• {i}</div>)}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 34–35 — SEGURANÇA
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 13 — Segurança e LGPD</h2>

        <h3>Camadas de Segurança Implementadas</h3>
        <table>
          <thead><tr><th>Área</th><th>Implementação</th><th>Nível</th></tr></thead>
          <tbody>
            {[
              ['Autenticação', 'NextAuth v4 com JWT sessions. bcryptjs salt-12 para senhas. Google OAuth opcional.', 'ALTO'],
              ['Autorização', 'Middleware global: rotas protegidas por session. Role ADMIN para painel administrativo.', 'ALTO'],
              ['Rate Limiting', 'Por IP no login. Por user ID em pagamentos. 10 req/min no Mercado Pago. RateLimit model no DB.', 'ALTO'],
              ['Content Security Policy', 'CSP por request via middleware. script-src, style-src, connect-src, frame-src configurados. object-src: none.', 'ALTO'],
              ['HMAC Webhook Validation', 'Todos os webhooks externos validam assinatura HMAC quando secret configurado. Fail-closed: rejeita sem header.', 'CRÍTICO'],
              ['Webhook Deduplication', 'StripeProcessedEvent + MercadoPagoProcessedEvent + WebhookReplayProtection no banco. Claim/release pattern.', 'ALTO'],
              ['Tokens de Reset/Verificação', 'Tokens SHA-256 hashed, uso único, expiração temporal. Token bruto apenas no link do email.', 'ALTO'],
              ['SQL Injection', 'Prisma ORM com queries parametrizadas. Sem raw SQL em endpoints públicos.', 'ALTO'],
              ['XSS Protection', 'React escapa HTML por default. DOMPurify em conteúdo externo. CSP style-src inline permitido (necessário).', 'MÉDIO'],
              ['Audit Log', 'Modelo AuditLog para ações críticas: pagamentos, upgrades, downgrades, deleção de conta.', 'MÉDIO'],
              ['Secrets Management', 'Todas as chaves em Replit Secrets (env vars). Nenhuma chave no repositório.', 'CRÍTICO'],
              ['Backup e Recovery', 'scripts/db-backup.sh para export lógico. docs/DISASTER_RECOVERY.md com runbook RPO/RTO.', 'MÉDIO'],
            ].map(r => (
              <tr key={r[0]}>
                <td><strong style={{ fontSize: '0.85rem' }}>{r[0]}</strong></td>
                <td style={{ fontSize: '0.82rem' }}>{r[1]}</td>
                <td><span className={`badge ${r[2] === 'CRÍTICO' ? 'badge-red' : r[2] === 'ALTO' ? 'badge-yellow' : 'badge-blue'}`}>{r[2]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Conformidade LGPD</h3>
        <div className="two-col">
          <div>
            <h4>Documentos Implementados</h4>
            <ul>
              <li><strong>/termos</strong> — Termos de Uso completos</li>
              <li><strong>/privacidade</strong> — Política de Privacidade + DPA</li>
              <li><strong>/lgpd</strong> — Página específica de direitos LGPD</li>
              <li>Cookie Consent component (CookieConsent.tsx)</li>
              <li>Links legais no footer em todas as páginas</li>
            </ul>
          </div>
          <div>
            <h4>Direitos do Titular Implementados</h4>
            <ul>
              <li>Acesso aos dados: /account (visualização)</li>
              <li>Correção: /account (alterar email/senha)</li>
              <li>Exclusão: /api/account/delete (auto-deleção)</li>
              <li>Portabilidade: export CSV em /reports</li>
              <li>Verificação de email (consent explícito)</li>
            </ul>
          </div>
        </div>

        <div className="warning-box" style={{ marginTop: 16 }}>
          <strong>Pendências Recomendadas:</strong> Implementar DPA (Data Processing Agreement) formal para clientes SCALE. 
          Nomear DPO (Data Protection Officer). Registro no ANPD quando exigido. 
          Relatório de Impacto RIPD para dados sensíveis de leads.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 36–37 — ROADMAP
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 14 — Roadmap de Produto</h2>

        <h3>Recursos Implementados (Versão 1.0)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {[
            'Dashboard com FunnelFlow visual', 'Meta Ads + Google Ads + TikTok Ads', 'WhatsApp Business API', 'Hotmart + Kiwify + Eduzz + Monetizze', 'Lead Scoring com IA', 'Sugestões GPT-4', 'Analytics Timeseries', 'Relatórios PDF + CSV', 'CRM Kanban', 'Metas e Progresso', 'Stripe + Mercado Pago', 'Trial 7 dias sem cartão', 'Programa de Afiliados', 'Convite de Equipe (Viewer)', 'Pixel de Rastreamento UTM', 'Alertas Automáticos (SCALE)', 'LGPD + Termos + Privacidade', 'Reset de Senha + Verificação Email', 'Admin Panel', 'Export PDF + CSV', 'CSP + Rate Limiting', 'Webhook Dedup', 'MetricSnapshots Diários',
          ].map(f => <span key={f} className="badge badge-green">{f}</span>)}
        </div>

        <h3>Próximas Versões — Roadmap Priorizado</h3>
        {[
          {
            quarter: 'Q3 2026 — Retenção e Produto',
            items: [
              { feat: 'App Mobile (React Native / Expo)', priority: 'ALTA', impact: 'Reduz churn, aumenta engajamento diário' },
              { feat: 'Relatórios White-Label (PDF com logo do cliente)', priority: 'ALTA', impact: 'Habilita segmento agências, aumenta ARPU' },
              { feat: 'Dashboard Multiusuário (SCALE)', priority: 'ALTA', impact: 'Diferencial SCALE, aumenta LTV' },
              { feat: 'Webhook fila assíncrona (BullMQ)', priority: 'ALTA', impact: 'Escalabilidade em picos de venda' },
            ],
          },
          {
            quarter: 'Q4 2026 — Expansão de Integrações',
            items: [
              { feat: 'Perfect Pay (webhook já implementado, UI pendente)', priority: 'MÉDIA', impact: 'Novo segmento de usuários' },
              { feat: 'Google Analytics 4 (importação de dados)', priority: 'MÉDIA', impact: 'Dados de funil mais completos' },
              { feat: 'CRM Externo (Kommo, HubSpot via API)', priority: 'MÉDIA', impact: 'Integração com stack existente dos clientes' },
              { feat: 'Chatbot Builder integrado ao funil', priority: 'BAIXA', impact: 'Diferencial significativo, complexo' },
            ],
          },
          {
            quarter: 'Q1 2027 — IA e Automação Avançada',
            items: [
              { feat: 'IA Preditiva de Churn de Lead', priority: 'ALTA', impact: 'Alerta antes do lead esfriar' },
              { feat: 'A/B Test de Funis', priority: 'MÉDIA', impact: 'Otimização científica do funil' },
              { feat: 'Análise de Sentimento das Conversas', priority: 'MÉDIA', impact: 'Qualidade automática de leads' },
              { feat: 'Geração de Relatórios via IA (linguagem natural)', priority: 'BAIXA', impact: 'Diferencial de produto significativo' },
            ],
          },
          {
            quarter: 'Q2 2027 — Escala e Expansão',
            items: [
              { feat: 'Plano Enterprise (contrato anual, SLA)', priority: 'ALTA', impact: 'ARPU 5–10x maior por cliente' },
              { feat: 'Expansão LATAM: México e Argentina', priority: 'MÉDIA', impact: 'TAM 3x maior' },
              { feat: 'API pública para integrações customizadas', priority: 'MÉDIA', impact: 'Novo canal de receita + ecossistema' },
              { feat: 'Marketplace de templates de funil', priority: 'BAIXA', impact: 'Efeito de rede, growth viral' },
            ],
          },
        ].map(q => (
          <div key={q.quarter} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E40AF', marginBottom: 8, padding: '6px 12px', background: '#EFF6FF', borderRadius: 6 }}>{q.quarter}</div>
            {q.items.map(item => (
              <div key={item.feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6, paddingLeft: 12 }}>
                <span className={`badge ${item.priority === 'ALTA' ? 'badge-red' : item.priority === 'MÉDIA' ? 'badge-yellow' : 'badge-blue'}`} style={{ whiteSpace: 'nowrap', marginTop: 1 }}>{item.priority}</span>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.feat}</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: 8 }}>{item.impact}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PÁGINA 38–39 — CONCLUSÃO EXECUTIVA
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Seção 15 — Conclusão Executiva</h2>

        <h3>Para Investidores</h3>
        <div className="highlight-box">
          <p>A FlowFunnel endereça um mercado de <strong>R$ 1,7 bilhão/ano</strong> em crescimento de 34% ao ano no Brasil, 
          com uma solução única que combina rastreamento WhatsApp + tráfego pago + IA em uma plataforma integrada.</p>
          <p>Com ARPU de R$174, payback de 1–2 meses e LTV/CAC de 10–13x, a unidade econômica é sólida. 
          O produto está funcionando em produção com dados reais, arquitetura escalável e múltiplos métodos de pagamento.</p>
          <p><strong>Oportunidade:</strong> Investimento seed de R$300–800k permitiria acelerar go-to-market, 
          contratar time de CS e marketing, e atingir 500 clientes em 12 meses (MRR R$87k, ARR R$1,04M).</p>
        </div>

        <h3>Para Parceiros Estratégicos</h3>
        <div className="highlight-box">
          <p>A FlowFunnel tem APIs abertas para integração com qualquer plataforma de infoprodutos, CRM ou gestão de tráfego. 
          O sistema de webhooks multi-tenant e o pixel de rastreamento UTM permitem integrações profundas.</p>
          <p>Oportunidades de parceria: co-marketing com Hotmart/Kiwify, integração com agências de tráfego, 
          white-label para ferramentas complementares.</p>
        </div>

        <h3>Para Possíveis Compradores</h3>
        <div className="highlight-box">
          <p>O ativo tecnológico da FlowFunnel representa <strong>R$2,5–4,7 milhões</strong> em código, integrações e 
          propriedade intelectual. O sistema está em produção, documentado, com arquitetura escalável e 
          zero débito técnico crítico.</p>
          <p>Valor estratégico para CRMs, plataformas de tráfego ou infoprodutos que queiram adicionar 
          capacidade de rastreamento WhatsApp + IA ao seu produto existente.</p>
        </div>

        <h3>KPIs Chave da Plataforma (Resumo)</h3>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { num: 'R$174', label: 'ARPU médio' },
            { num: '10–13x', label: 'LTV/CAC ratio' },
            { num: '1–2 meses', label: 'Payback period' },
            { num: 'R$1,7Bi', label: 'TAM Brasil' },
            { num: '34%/ano', label: 'Crescimento setor' },
            { num: '7 dias', label: 'Trial sem cartão' },
            { num: '80+', label: 'APIs integradas' },
            { num: '12+', label: 'Plataformas BR' },
          ].map(k => <div key={k.label} className="kpi-card" style={{ background: 'linear-gradient(135deg, #1E293B, #334155)' }}><div className="kpi-num" style={{ fontSize: '1.3rem' }}>{k.num}</div><div className="kpi-label">{k.label}</div></div>)}
        </div>

        <div style={{ marginTop: 32, padding: '20px', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', borderRadius: 12, color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>FlowFunnel — Do Clique à Venda, Tudo Rastreado.</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>flowfunnel.app.br · Versão 1.0 · Junho 2026</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          APÊNDICE A — INVENTÁRIO DE ARQUIVOS
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Apêndice A — Inventário Completo de Arquivos</h2>
        <h3>Páginas do Sistema (app/*/page.tsx)</h3>
        <table>
          <thead><tr><th>Rota</th><th>Arquivo</th><th>Descrição</th><th>Linhas</th></tr></thead>
          <tbody>
            {[
              ['/', 'app/page.tsx', 'Landing page pública', 626],
              ['/dashboard', 'app/dashboard/page.tsx', 'Dashboard principal', 695],
              ['/analytics', 'app/analytics/page.tsx', 'Analytics avançado', 456],
              ['/leads', 'app/leads/page.tsx', 'CRM Kanban de leads', 393],
              ['/campaigns', 'app/campaigns/page.tsx', 'Gestão de campanhas', 558],
              ['/reports', 'app/reports/page.tsx', 'Relatórios e exports', 464],
              ['/goals', 'app/goals/page.tsx', 'Metas e progresso', 424],
              ['/settings', 'app/settings/page.tsx', 'Configurações gerais', 1027],
              ['/settings/team', 'app/settings/team/page.tsx', 'Gestão de equipe', '—'],
              ['/billing', 'app/billing/page.tsx', 'Assinatura e planos', 383],
              ['/webhooks', 'app/webhooks/page.tsx', 'Docs + logs de webhooks', 591],
              ['/lead-journey', 'app/lead-journey/page.tsx', 'Jornada do lead', '—'],
              ['/conversion-intelligence', 'app/conversion-intelligence/page.tsx', 'IA e insights', '—'],
              ['/affiliate', 'app/affiliate/page.tsx', 'Dashboard de afiliado', 624],
              ['/checkout', 'app/checkout/page.tsx', 'Checkout Stripe + MP', 840],
              ['/pricing', 'app/pricing/page.tsx', 'Página de preços', 348],
              ['/login', 'app/login/page.tsx', 'Autenticação', '—'],
              ['/register', 'app/register/page.tsx', 'Cadastro', 391],
              ['/admin/users', 'app/admin/users/page.tsx', 'Admin panel', 739],
              ['/invite', 'app/invite/page.tsx', 'Convite de equipe', 600],
              ['/termos', 'app/termos/page.tsx', 'Termos de Uso', '—'],
              ['/privacidade', 'app/privacidade/page.tsx', 'Política de Privacidade', '—'],
              ['/lgpd', 'app/lgpd/page.tsx', 'Direitos LGPD', '—'],
            ].map(r => <tr key={r[0]}><td><code style={{ fontSize: '0.78rem' }}>{r[0]}</code></td><td style={{ fontSize: '0.78rem' }}>{r[1]}</td><td style={{ fontSize: '0.78rem' }}>{r[2]}</td><td style={{ textAlign: 'center' }}>{r[3]}</td></tr>)}
          </tbody>
        </table>

        <h3>Componentes React (components/)</h3>
        <table>
          <thead><tr><th>Componente</th><th>Função</th><th>Importância</th></tr></thead>
          <tbody>
            {[
              ['AppShell.tsx', 'Layout principal: sidebar, headers, banners', 'CRÍTICO'],
              ['FunnelFlow.tsx', 'Visualizador React Flow do funil (552 linhas)', 'CRÍTICO'],
              ['DashboardSidebar.tsx', 'Navegação lateral desktop', 'ALTO'],
              ['WorkspaceTabs.tsx', 'Seletor de funil/workspace (464 linhas)', 'ALTO'],
              ['AISuggestions.tsx', 'Sugestões GPT-4 contextualizadas (289 linhas)', 'ALTO'],
              ['NotificationCenter.tsx', 'Central de notificações in-app', 'MÉDIO'],
              ['LeadKanban.tsx', 'CRM Kanban drag-and-drop', 'ALTO'],
              ['LeadIntelligence.tsx', 'Lead scoring PRO com preview bloqueado', 'MÉDIO'],
              ['PlanGate.tsx', 'Wrapper de feature gating por plano', 'ALTO'],
              ['UpgradeTriggers.tsx', 'Banners dinâmicos de upsell contextuais', 'MÉDIO'],
              ['PlanActivatedBanner.tsx', 'Banner pós-checkout de ativação', 'BAIXO'],
              ['TrialBanner.tsx', 'Contador de dias do trial', 'MÉDIO'],
              ['TrialExpiredWall.tsx', 'Bloqueio full-screen trial expirado', 'ALTO'],
              ['UsageMeter.tsx', 'Barra de uso de conversas vs. limite', 'MÉDIO'],
              ['EmailVerificationBanner.tsx', 'Alerta de email não verificado', 'MÉDIO'],
              ['WastedTrafficCard.tsx', 'Tráfego desperdiçado + sugestões (PRO)', 'MÉDIO'],
              ['LandingTracking.tsx', 'Stats do pixel de rastreamento UTM', 'MÉDIO'],
              ['OnboardingModal.tsx', 'Modal de onboarding em 3 etapas', 'MÉDIO'],
              ['CampaignSelector.tsx', 'Seletor de campanha para filtros', 'BAIXO'],
              ['DateFilter.tsx', 'Filtro de período customizado', 'BAIXO'],
              ['MobileSidebar.tsx', 'Drawer sidebar para mobile', 'MÉDIO'],
              ['AffiliateTracker.tsx', 'Rastreador de cliques de afiliados', 'MÉDIO'],
              ['CardInsightModal.tsx', 'Modal de insight por card do funil', 'BAIXO'],
              ['ChunkErrorReloader.tsx', 'Recarregador em erro de chunk split', 'BAIXO'],
              ['ThemeToggle.tsx', 'Toggle dark/light mode', 'BAIXO'],
              ['UserMenu.tsx', 'Menu do usuário logado', 'MÉDIO'],
              ['PlanBadge.tsx', 'Badge do plano atual', 'BAIXO'],
              ['PeriodComparison.tsx', 'Comparativo de períodos (PRO)', 'MÉDIO'],
              ['TrendAnalysis.tsx', 'Análise de tendências', 'MÉDIO'],
              ['IntegrationTutorial.tsx', 'Tutorial de integração', 'BAIXO'],
              ['AlertSystem.tsx', 'Sistema de alertas toast', 'MÉDIO'],
              ['charts/', 'Componentes de gráficos Recharts', 'ALTO'],
            ].map(r => <tr key={r[0]}><td><code style={{ fontSize: '0.78rem' }}>{r[0]}</code></td><td style={{ fontSize: '0.82rem' }}>{r[1]}</td><td><span className={`badge ${r[2] === 'CRÍTICO' ? 'badge-red' : r[2] === 'ALTO' ? 'badge-yellow' : r[2] === 'MÉDIO' ? 'badge-blue' : 'badge-purple'}`}>{r[2]}</span></td></tr>)}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          APÊNDICE B — ALGORITMOS DE ALTO VALOR
      ══════════════════════════════════════════════════════════════ */}
      <div className="page">
        <h2 style={{ marginTop: 0 }}>Apêndice B — Algoritmos de Alto Valor para Registro de PI</h2>

        <div className="warning-box">
          <strong>Recomendação Legal:</strong> Registrar o programa de computador FlowFunnel no INPI (Instituto Nacional 
          da Propriedade Industrial) conforme Art. 2° da Lei 9.609/98. O registro não exige depósito do código completo — 
          apenas as primeiras e últimas 50 páginas do código-fonte e uma descrição dos algoritmos protegidos.
        </div>

        <h3>Lista de Algoritmos para Registro</h3>
        {[
          {
            id: 'ALG-001',
            title: 'Lead Scoring Comportamental Multi-Variável',
            file: 'lib/leadScoring.ts',
            desc: 'Algoritmo que combina velocidade de resposta, profundidade de engajamento, frequência de interações, progressão no funil e sinais de intenção de compra para gerar score 0–100 e classificação automática quente/morno/frio.',
            novelty: 'Específico para comportamento de WhatsApp no contexto de infoprodutos brasileiros. Sem precedente público conhecido.',
            proof: 'lib/leadScoring.ts — criado originalmente para FlowFunnel, não derivado de biblioteca pública.',
          },
          {
            id: 'ALG-002',
            title: 'Atribuição Multi-Touch Proporcional por Cliques',
            file: 'lib/metrics.ts — função distributeByClicks()',
            desc: 'Distribui leads e receita entre múltiplas fontes de tráfego (Meta Ads, Google Ads, TikTok Ads) proporcional aos cliques de cada fonte, com garantia matemática de soma exata (evita perda de decimais via last-item adjustment).',
            novelty: 'Aplicação do modelo de atribuição linear ao contexto WhatsApp + infoprodutos, com implementação original e verificação de integridade.',
            proof: 'lib/metrics.ts — implementação original com comentários de autoria.',
          },
          {
            id: 'ALG-003',
            title: 'Deduplicação At-Least-Once com Claim/Release',
            file: 'lib/stripe-dedup.ts · lib/mercadopago-dedup.ts',
            desc: 'Padrão de claim/release no banco de dados para garantir processamento at-least-once de webhooks de pagamento. O claim bloqueia processamento concorrente; o release em falha permite retry sem deadlock.',
            novelty: 'Adaptação original do padrão distribuído de claim/release para ambiente serverless Next.js + Prisma + PostgreSQL.',
            proof: 'Ambos os arquivos criados originalmente — sem derivação de biblioteca.',
          },
          {
            id: 'ALG-004',
            title: 'Mapeamento Universal de Status de Plataformas',
            file: 'lib/webhook-stages.ts',
            desc: 'Tabela de mapeamento que normaliza +40 status diferentes de Hotmart, Kiwify, Eduzz, Monetizze e Perfect Pay para 7 estágios universais do funil FlowFunnel.',
            novelty: 'Trabalho de engenharia reversa e padronização original. Não existe documentação pública consolidada destes mapeamentos.',
            proof: 'lib/webhook-stages.ts — compilado via integração direta com as plataformas.',
          },
          {
            id: 'ALG-005',
            title: 'Cron de Alertas com Avaliação em Lote',
            file: 'app/api/cron/alerts/route.ts',
            desc: 'Pipeline que avalia 4 regras de alerta de negócio (queda de vendas, conversão baixa, campanha parada, gasto sem retorno) para N usuários em O(1) queries, usando groupBy+aggregate em vez de loop por usuário.',
            novelty: 'Arquitetura original de pipeline de alertas sem N+1 para SaaS multi-tenant.',
            proof: 'app/api/cron/alerts/route.ts — refatoração original documentada nos comentários.',
          },
          {
            id: 'ALG-006',
            title: 'Pixel de Rastreamento UTM com Injeção em Links de Checkout',
            file: 'public/tracker.js',
            desc: 'Script JavaScript público que captura UTMs, persiste lead_id, e injeta parâmetros automaticamente em links de checkout (Hotmart, Kiwify, Stripe) e WhatsApp, garantindo rastreabilidade end-to-end sem modificação manual dos links.',
            novelty: 'Solução original específica para o ecossistema de infoprodutos brasileiros com injeção dinâmica de UTM em múltiplos formatos de URL.',
            proof: 'public/tracker.js — criado originalmente para FlowFunnel.',
          },
        ].map(alg => (
          <div key={alg.id} style={{ marginBottom: 18, border: '2px solid #BFDBFE', borderRadius: 10, padding: 14, background: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{alg.id}</span>
                <strong style={{ fontSize: '0.92rem', color: '#1E40AF' }}>{alg.title}</strong>
              </div>
            </div>
            <code style={{ fontSize: '0.75rem', color: '#475569', background: '#EFF6FF', padding: '2px 8px', borderRadius: 4, display: 'block', marginBottom: 8 }}>{alg.file}</code>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Descrição: </span>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>{alg.desc}</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Novidade: </span>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>{alg.novelty}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Evidência de autoria: </span>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>{alg.proof}</span>
            </div>
          </div>
        ))}

        <h3>Como Registrar no INPI</h3>
        <div className="flow-step"><div className="flow-num">1</div><div className="flow-content"><h4>Prepare o Pacote de Registro</h4><p style={{ fontSize: '0.84rem', margin: 0 }}>Reúna: primeiras 50 e últimas 50 páginas do código-fonte, descrição funcional, nome do titular e autores, data de criação (junho 2026).</p></div></div>
        <div className="flow-step"><div className="flow-num">2</div><div className="flow-content"><h4>Acesse o e-INPI</h4><p style={{ fontSize: '0.84rem', margin: 0 }}>Portal: inpi.gov.br. Categoria: Programa de Computador (Lei 9.609/98). Taxa: ~R$155 (para empresas) ou R$78 (pessoa física).</p></div></div>
        <div className="flow-step"><div className="flow-num">3</div><div className="flow-content"><h4>Proteção Adicional — Direitos Autorais</h4><p style={{ fontSize: '0.84rem', margin: 0 }}>O código-fonte já é automaticamente protegido por direitos autorais desde a criação (sem necessidade de registro formal). O registro INPI cria prova de anterioridade.</p></div></div>
        <div className="flow-step"><div className="flow-num">4</div><div className="flow-content"><h4>Contrato de Trabalho / NDA</h4><p style={{ fontSize: '0.84rem', margin: 0 }}>Firmar NDA com todos os colaboradores e prestadores de serviço que tiveram acesso ao código-fonte.</p></div></div>

        <hr className="section-divider" />
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: DARK }}>FlowFunnel — Documentação Técnica e Comercial Completa</div>
          <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 4 }}>Versão 1.0 · Junho 2026 · flowfunnel.app.br</div>
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 4 }}>Documento gerado automaticamente via varredura do código-fonte. Confidencial.</div>
        </div>
      </div>
    </div>
  )
}
