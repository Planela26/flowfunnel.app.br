"use client";
import UserMenu from '@/components/UserMenu'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { MessageCircle, Settings, Download, MousePointer2, Eye, Target, TrendingUp, DollarSign, BarChart3, Zap, Trophy, Pin, AlertTriangle, Smartphone, Megaphone, Plug2, ArrowRight } from 'lucide-react'
import { useFunnelView } from '@/hooks/useFunnelView'
import { PERIODOS, periodoPor, opcoesDePeriodo } from '@/lib/periodo'
import CardInsightModal from '@/components/CardInsightModal'
import DateFilter from '@/components/DateFilter'
import AlertSystem, { Alert } from '@/components/AlertSystem'
import UsageMeter from '@/components/UsageMeter'
import dynamic from 'next/dynamic'
const AISuggestions = dynamic(() => import('@/components/AISuggestions'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 h-32 animate-pulse" />
  ),
})
import NotificationCenter from '@/components/NotificationCenter'
import { calculateCTR, calculateCPC, calculateCPM, calculateConversion, calculateROI, calculateROAS, hasROI, distributeByClicks } from '@/lib/metrics'
import CampaignSelector from '@/components/CampaignSelector'
import WorkspaceTabs, { Workspace } from '@/components/WorkspaceTabs'
import PlanBadge from '@/components/PlanBadge'
import PlanActivatedBanner from '@/components/PlanActivatedBanner'
const FunnelFlow = dynamic(() => import('@/components/FunnelFlow'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 h-80 flex flex-col items-center justify-center gap-3 shadow-sm">
      <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Carregando funil...</p>
    </div>
  ),
})
import UpgradeTriggers from '@/components/UpgradeTriggers'
import { usePlan } from '@/components/usePlan'
import Link from 'next/link'
import SaraInsightsPanel from '@/components/SaraInsightsPanel'

const estimateWhatsAppConversations = (clicks: number) => Math.max(0, Math.round(clicks * 0.18))


export default function Dashboard() {
  const { info: planInfo } = usePlan()
  const [viewMode, setViewMode] = useState<'produtor' | 'gestor'>('gestor')
  const [insightModal, setInsightModal] = useState<{ cardType: string; data: any } | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('7days')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  // Criar ou salvar um funil muda quais cards ele mostra, e SALVAR não muda o
  // id — então o efeito de useFunnelView não reagiria sozinho. Este contador é
  // o gatilho: sobe a cada mudança e força a releitura do servidor, para o
  // canvas refletir a configuração na hora, sem recarregar a página.
  const [versaoDoFunil, setVersaoDoFunil] = useState(0)
  const { data: session } = useSession()
  const userId = session?.user?.id as string | undefined
  // O funil aberto entra aqui: arranjo e cards visíveis são POR FUNIL. Sem
  // isto, os dois funis liam e gravavam o mesmo registro, e mexer num mexia no
  // outro.
  const { visibleIds, addCard, removeCard } = useFunnelView(userId, activeWorkspace?.id ?? null, versaoDoFunil)
  const [whatsappData, setWhatsappData] = useState<any>(null)
  const [facebookData, setFacebookData] = useState<any>(null)
  const [googleData, setGoogleData] = useState<any>(null)
  const [tiktokData, setTiktokData] = useState<any>(null)
  const [landingData, setLandingData] = useState<any>(null)
  const [hotmartData, setHotmartData] = useState<any>(null)
  const [kiwifyData, setKiwifyData] = useState<any>(null)
  const [eduzzData, setEduzzData] = useState<any>(null)
  const [monetizzeData, setMonetizzeData] = useState<any>(null)
  const [stripeData, setStripeData] = useState<any>(null)
  const [mercadopagoData, setMercadopagoData] = useState<any>(null)
  const [crmData, setCrmData] = useState<any>(null)
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(true)
  const [loadingFacebook, setLoadingFacebook] = useState(true)
  const [loadingGoogle, setLoadingGoogle] = useState(true)
  const [loadingTiktok, setLoadingTiktok] = useState(true)
  const [loadingLanding, setLoadingLanding] = useState(true)
  const [loadingHotmart, setLoadingHotmart] = useState(true)
  const [loadingKiwify, setLoadingKiwify] = useState(true)
  const [loadingEduzz, setLoadingEduzz] = useState(true)
  const [loadingMonetizze, setLoadingMonetizze] = useState(true)
  const [loadingStripe, setLoadingStripe] = useState(true)
  const [loadingMercadopago, setLoadingMercadopago] = useState(true)
  const [loadingCrm, setLoadingCrm] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedSource, setSelectedSource] = useState<'all' | 'facebook' | 'google' | 'tiktok'>('all')
  // Janela escolhida no seletor do topo, no formato que as rotas de métricas
  // esperam. UM valor para TODOS os cards: antes só os de mídia paga
  // respondiam ao seletor, e os de checkout ficavam presos em 30 dias.
  const dias = periodoPor(selectedPeriod).dias
  const estimatedWhatsAppConversations = estimateWhatsAppConversations(facebookData?.cliques || 0)

  // Buscar dados reais do WhatsApp — filtra pelo workspace ativo
  /**
   * `trocouDeWorkspace` separa dois tipos de falha que não podem ser tratados
   * igual.
   *
   * Numa atualização de rotina os parâmetros são os mesmos, então o último dado
   * bom continua válido e apagá-lo só faria o card piscar. Mas quando o
   * workspace muda, o dado em tela é de OUTRO workspace — mantê-lo mostraria
   * números de um cliente sob o nome de outro, que é pior do que não mostrar
   * nada.
   */
  const fetchWhatsAppMetrics = useCallback(async (trocouDeWorkspace = false) => {
    try {
      setLoadingWhatsApp(true)
      // `days` acompanha o seletor do topo, como nos demais cards. Sem isto o
      // WhatsApp ficava cravado em 30 dias enquanto o resto da tela mudava.
      let url = `/api/whatsapp/metrics?days=${dias}`
      if (activeWorkspace?.whatsappIntegrationId) {
        url += `&integrationId=${activeWorkspace.whatsappIntegrationId}`
      }
      const response = await fetch(url)
      if (response.ok) {
        setWhatsappData(await response.json())
        return
      }
      if (trocouDeWorkspace) setWhatsappData(null)
    } catch (error) {
      console.error('Erro ao buscar métricas WhatsApp:', error)
      if (trocouDeWorkspace) setWhatsappData(null)
    } finally {
      setLoadingWhatsApp(false)
    }
  }, [activeWorkspace?.whatsappIntegrationId, dias])

  useEffect(() => {
    // O efeito só roda de novo quando o workspace muda, então esta primeira
    // chamada é sempre a de parâmetros novos.
    fetchWhatsAppMetrics(true);
    const interval = setInterval(() => fetchWhatsAppMetrics(false), 300000);
    return () => clearInterval(interval);
  }, [fetchWhatsAppMetrics]);

  // Buscar dados reais do Facebook — filtra pelo workspace ativo (campanha vinculada)
  useEffect(() => {
    const fetchFacebookMetrics = async () => {
      try {
        setLoadingFacebook(true)
        const period = periodoPor(selectedPeriod).meta
        // Prioridade: campanha do workspace > campanha selecionada manualmente
        const campaignId = activeWorkspace?.facebookCampaignId || selectedCampaign
        let url = `/api/facebook/metrics?period=${period}`
        if (campaignId) url += `&campaignId=${campaignId}`
        const response = await fetch(url)
        // Mantém o último dado bom em vez de zerar — mesma razão já documentada
        // no card da Landing Page logo abaixo. Zerando, uma falha passageira
        // (sessão renovando, rede oscilando, Meta lenta) apagava o card do Meta
        // Ads, e ele voltava sozinho na rodada seguinte: era isso que fazia os
        // números aparecerem e sumirem sem motivo aparente.
        if (!response.ok) return
        const data = await response.json()
        setFacebookData(data)
      } catch (error) {
        console.error('Erro ao buscar métricas Facebook:', error)
      } finally {
        setLoadingFacebook(false)
      }
    }

    fetchFacebookMetrics()
  }, [selectedPeriod, selectedCampaign, activeWorkspace?.facebookCampaignId])

  // Buscar dados de Google Ads e TikTok Ads
  useEffect(() => {
    const period = periodoPor(selectedPeriod).meta
    const fetchOther = async () => {
      try {
        setLoadingGoogle(true)
        setLoadingTiktok(true)
        const [g, t] = await Promise.all([
          fetch(`/api/google/metrics?period=${period}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/tiktok/metrics?period=${period}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ])
        setGoogleData(g)
        setTiktokData(t)
      } catch {
        setGoogleData(null)
        setTiktokData(null)
      } finally {
        setLoadingGoogle(false)
        setLoadingTiktok(false)
      }
    }
    fetchOther()
  }, [selectedPeriod])

  // Mapeamento de períodos para API do Facebook (para uso em outros contextos)
  const period = periodoPor(selectedPeriod).meta
  const campaignParam = selectedCampaign ? `&campaignId=${selectedCampaign}` : ''

  // Landing Page — lê o rastreamento que já existe (tracker.js + link
  // rastreável). Mesma cadência dos demais cards.
  useEffect(() => {
    const fetchLandingMetrics = async () => {
      try {
        setLoadingLanding(true)
        const wsl = activeWorkspace?.id ? `&workspaceId=${activeWorkspace.id}` : ''
        const response = await fetch(`/api/landing/metrics?days=${dias}${wsl}`)
        if (!response.ok) return // ver comentário abaixo
        setLandingData(await response.json())
      } catch (error) {
        console.error('Erro ao buscar métricas da Landing Page:', error)
        // Mantém o último dado bom em vez de zerar.
        //
        // A busca se repete a cada 5 minutos. Zerando, uma única falha
        // passageira — sessão renovando, rede oscilando — apagava o card e ele
        // só voltava na próxima rodada: era isso que fazia o card ora mostrar
        // as visitas, ora parecer sem integração. Rastreamento instalado não
        // desaparece porque uma requisição falhou.
      } finally {
        setLoadingLanding(false)
      }
    }

    fetchLandingMetrics()
    const interval = setInterval(fetchLandingMetrics, 300000)
    return () => clearInterval(interval)
    // `activeWorkspace?.id` entra aqui pelo mesmo motivo do card do Hotmart:
    // sem ele, trocar de funil deixava na tela os visitantes do funil anterior
    // até a atualização automática de 5 minutos.
  }, [dias, activeWorkspace?.id])

  // Buscar dados reais do Hotmart
  useEffect(() => {
    const fetchHotmartMetrics = async () => {
      try {
        setLoadingHotmart(true)
        const wsq = activeWorkspace?.id ? `&workspaceId=${activeWorkspace.id}` : ''
        const response = await fetch(`/api/hotmart/metrics?days=${dias}${wsq}`)
        if (!response.ok) return // preserva o último dado bom — ver Landing Page
        setHotmartData(await response.json())
      } catch (error) {
        console.error('Erro ao buscar métricas Hotmart:', error)
      } finally {
        setLoadingHotmart(false)
      }
    }

    fetchHotmartMetrics()
    const interval = setInterval(fetchHotmartMetrics, 300000) // 5 minutos
    return () => clearInterval(interval)
    // `activeWorkspace?.id` entra aqui: sem ele, trocar de funil deixava na tela
    // os números do funil anterior até o refresh de 5 minutos.
  }, [dias, activeWorkspace?.id])

  // Buscar dados reais do Kiwify
  useEffect(() => {
    const fetchKiwifyMetrics = async () => {
      try {
        setLoadingKiwify(true)
        const response = await fetch(`/api/kiwify/metrics?days=${dias}`)
        if (!response.ok) return // preserva o último dado bom — ver Landing Page
        setKiwifyData(await response.json())
      } catch {
        /* mantém o último dado bom */
      } finally {
        setLoadingKiwify(false)
      }
    }
    fetchKiwifyMetrics()
    const interval = setInterval(fetchKiwifyMetrics, 300000)
    return () => clearInterval(interval)
  }, [dias])

  // Fetch Eduzz metrics
  useEffect(() => {
    const fetchEduzzMetrics = async () => {
      try {
        setLoadingEduzz(true)
        const response = await fetch(`/api/eduzz/metrics?days=${dias}`)
        if (!response.ok) return // preserva o último dado bom — ver Landing Page
        setEduzzData(await response.json())
      } catch {
        /* mantém o último dado bom */
      } finally {
        setLoadingEduzz(false)
      }
    }
    fetchEduzzMetrics()
    const interval = setInterval(fetchEduzzMetrics, 300000)
    return () => clearInterval(interval)
  }, [dias])

  // Fetch Monetizze metrics
  useEffect(() => {
    const fetchMonetizzeMetrics = async () => {
      try {
        setLoadingMonetizze(true)
        const response = await fetch(`/api/monetizze/metrics?days=${dias}`)
        if (!response.ok) return // preserva o último dado bom — ver Landing Page
        setMonetizzeData(await response.json())
      } catch {
        /* mantém o último dado bom */
      } finally {
        setLoadingMonetizze(false)
      }
    }
    fetchMonetizzeMetrics()
    const interval = setInterval(fetchMonetizzeMetrics, 300000)
    return () => clearInterval(interval)
  }, [dias])

  // Fetch Stripe metrics (payment data)
  useEffect(() => {
    const fetchStripeMetrics = async () => {
      try {
        setLoadingStripe(true)
        const response = await fetch('/api/stripe/subscription')
        const data = response.ok ? await response.json() : null
        setStripeData(data ? { connected: true, ...data } : null)
      } catch {
        setStripeData(null)
      } finally {
        setLoadingStripe(false)
      }
    }
    fetchStripeMetrics()
  }, [])

  // Fetch Mercado Pago metrics
  useEffect(() => {
    const fetchMercadopagoMetrics = async () => {
      try {
        setLoadingMercadopago(true)
        const response = await fetch('/api/mercadopago/public-key')
        const data = response.ok ? await response.json() : null
        setMercadopagoData(data ? { connected: true, ...data } : null)
      } catch {
        setMercadopagoData(null)
      } finally {
        setLoadingMercadopago(false)
      }
    }
    fetchMercadopagoMetrics()
  }, [])

  // CRM (placeholder until CRM integration exists)
  useEffect(() => {
    setLoadingCrm(false)
    setCrmData(null)
  }, [])

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id))
  }

  const [comparisonData, setComparisonData] = useState({
    current:  { vendas: 0, faturamento: 0, leads: 0, conversao: 0 },
    previous: { vendas: 0, faturamento: 0, leads: 0, conversao: 0 },
  })

  // Buscar comparação de períodos do banco de dados real
  // Apenas planos PRO/SCALE têm acesso (feature 'period_comparison')
  useEffect(() => {
    if (!planInfo.features.period_comparison) {
      setComparisonData({
        current:  { vendas: 0, faturamento: 0, leads: 0, conversao: 0 },
        previous: { vendas: 0, faturamento: 0, leads: 0, conversao: 0 },
      })
      return
    }
    const p = periodoPor(selectedPeriod).comparacao
    fetch(`/api/analytics/comparison?period=${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setComparisonData(data) })
      .catch(() => {})
  }, [selectedPeriod, planInfo.features.period_comparison])

  const handleExportPDF = async () => {
    try {
      const startDate = customDateRange.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = customDateRange.end || new Date().toISOString()
      const url = `/api/reports/export-pdf?startDate=${startDate}&endDate=${endDate}`
      window.open(url, '_blank')
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      alert('Erro ao gerar relatório. Tente novamente.')
    }
  }

  const handleExportCSV = () => {
    const startDate = customDateRange.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = customDateRange.end || new Date().toISOString()
    window.location.href = `/api/reports/export-csv?startDate=${startDate}&endDate=${endDate}`
  }

  const handleWorkspaceChange = useCallback((ws: Workspace | null) => {
    setActiveWorkspace(ws)
  }, [])

  const handleWorkspaceSaved = useCallback(() => {
    setVersaoDoFunil((v) => v + 1)
  }, [])

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900 transition-colors">

      {/* Sistema de Alertas */}
      <AlertSystem alerts={alerts} onDismiss={dismissAlert} />

      {/* Banner de plano ativado após checkout */}
      <Suspense fallback={null}>
        <PlanActivatedBanner />
      </Suspense>

      {/* Faixa azul no topo — mobile only */}
      <div className="h-1 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 lg:hidden" />

      {/* Header — mobile only */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-blue-100 dark:border-gray-700 transition-colors lg:hidden">
        {/* Linha única: hamburger (fixo via AppShell) | logo | espaço | notif + plano + avatar */}
        <div className="flex items-center gap-2 pl-14 pr-3 h-12">
          {/* Logo */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img src="/flowsara-logo.jpg" alt="FlowSara" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-extrabold text-blue-900 dark:text-white tracking-tight leading-none">FlowSara</span>
          </div>

          <div className="flex-1" />

          {/* Direita: notificações + plano + avatar */}
          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            <PlanBadge />
            {/* Avatar compacto → abre /account */}
            <Link
              href="/account"
              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-[11px] font-bold text-white shadow-sm flex-shrink-0"
              title="Minha conta"
            >
              {(session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? 'U').toUpperCase()}
            </Link>
          </div>
        </div>

        {/* Linha 2: ações rápidas */}
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
          <Link href="/whatsapp-numbers" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg font-medium whitespace-nowrap flex-shrink-0">
            <Smartphone className="w-3 h-3" /> WhatsApp
          </Link>
          <Link href="/campaigns" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg font-medium whitespace-nowrap flex-shrink-0">
            <Megaphone className="w-3 h-3" /> Campanhas
          </Link>
          <Link href="/analytics" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded-lg font-medium whitespace-nowrap flex-shrink-0">
            <BarChart3 className="w-3 h-3" /> Analytics
          </Link>
          <button onClick={handleExportCSV} className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium whitespace-nowrap flex-shrink-0">
            <Download className="w-3 h-3" /> CSV
          </button>
          <Link href="/settings" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium whitespace-nowrap flex-shrink-0">
            <Settings className="w-3 h-3" /> Config
          </Link>
        </div>
      </header>

      {/* Abas de Funis/Workspaces */}
      <WorkspaceTabs onWorkspaceChange={handleWorkspaceChange} onWorkspaceSaved={handleWorkspaceSaved} />

      <main className="container mx-auto px-4 py-4">
        {/* Período dos cards.
            O estado existia e alimentava todas as buscas, mas nada na tela
            chamava `setSelectedPeriod` — ficava preso em 7 dias, e o card do
            Meta Ads mostrava uma janela que ninguém tinha escolhido. O rótulo
            aparece junto dos cards para que nenhum número fique sem contexto. */}
        <div className="mb-4">
          <DateFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            periods={opcoesDePeriodo()}
            customDateRange={customDateRange}
            onCustomDateChange={(start, end) => setCustomDateRange({ start, end })}
          />
        </div>

        {/* Workflow Canvas — funil visual interativo (topo) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Funil
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Números de: <strong className="text-gray-700 dark:text-gray-200">{periodoPor(selectedPeriod).rotulo}</strong>
            </span>
          </div>
          <FunnelFlow
            visibleIds={visibleIds}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            workspaceId={activeWorkspace?.id ?? null}
            dataMap={{
              facebook: facebookData,
              google: googleData,
              tiktok: tiktokData,
              landing: landingData,
              whatsapp: whatsappData,
              hotmart: hotmartData,
              kiwify: kiwifyData,
              eduzz: eduzzData,
              monetizze: monetizzeData,
              stripe: stripeData,
              mercadopago: mercadopagoData,
              crm: crmData,
            }}
            loadingMap={{
              facebook: loadingFacebook,
              google: loadingGoogle,
              tiktok: loadingTiktok,
              landing: loadingLanding,
              whatsapp: loadingWhatsApp,
              hotmart: loadingHotmart,
              kiwify: loadingKiwify,
              eduzz: loadingEduzz,
              monetizze: loadingMonetizze,
              stripe: loadingStripe,
              mercadopago: loadingMercadopago,
              crm: loadingCrm,
            }}
            onInsight={(cardType, data) => setInsightModal({ cardType, data })}
            planName={planInfo.plan}
            userId={userId}
          />
        </div>

        {/* Gatilhos dinâmicos de upgrade — só aparecem para FREE/START */}
        <UpgradeTriggers />

        {/* ── Resumo Geral ─────────────────────────────────────────────────── */}
        {(() => {
          const num = (v: number | null | undefined, prefix = '', suffix = '') =>
            v == null ? null : `${prefix}${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`

          // Fontes conectadas
          const fb = facebookData?.connected ? {
            label: 'Meta', color: 'text-gray-400', dot: 'bg-gray-500',
            cliques:     facebookData.raw?.clicks      ?? 0,
            impressoes:  facebookData.raw?.impressions ?? 0,
            spend:       facebookData.raw?.spend       ?? 0,
            leads:       facebookData.raw?.leads       ?? 0,
            roi:         facebookData.roi              ?? null,
          } : null

          const gg = googleData?.connected ? {
            label: 'Google', color: 'text-gray-400', dot: 'bg-gray-500',
            cliques:     googleData.raw?.clicks      ?? 0,
            impressoes:  googleData.raw?.impressions ?? 0,
            spend:       googleData.raw?.spend       ?? 0,
            leads:       0,
            roi:         null,
          } : null

          const tt = tiktokData?.connected ? {
            label: 'TikTok', color: 'text-gray-400', dot: 'bg-gray-500',
            cliques:     tiktokData.raw?.clicks      ?? 0,
            impressoes:  tiktokData.raw?.impressions ?? 0,
            spend:       tiktokData.raw?.spend       ?? 0,
            leads:       0,
            roi:         null,
          } : null

          type SourceEntry = { key: string; label: string; color: string; dot: string; cliques: number; impressoes: number; spend: number; leads: number; roi: string | null }

          // Fontes conectadas filtradas pelo seletor
          const allSourcesRaw: SourceEntry[] = [
            fb ? { key: 'facebook', label: fb.label, color: fb.color, dot: fb.dot, cliques: fb.cliques, impressoes: fb.impressoes, spend: fb.spend, leads: fb.leads, roi: fb.roi } : null,
            gg ? { key: 'google',   label: gg.label, color: gg.color, dot: gg.dot, cliques: gg.cliques, impressoes: gg.impressoes, spend: gg.spend, leads: gg.leads, roi: gg.roi } : null,
            tt ? { key: 'tiktok',   label: tt.label, color: tt.color, dot: tt.dot, cliques: tt.cliques, impressoes: tt.impressoes, spend: tt.spend, leads: tt.leads, roi: tt.roi } : null,
          ].filter((s): s is SourceEntry => s !== null)

          // Atribui leads e faturamento do funil (vendas/checkout) entre as fontes
          // proporcional aos cliques de cada fonte. A última fonte recebe o resto
          // para garantir que a soma das partes seja exatamente igual ao total.
          const totalFunnelLeads = planInfo.features.period_comparison ? (comparisonData.current.leads ?? 0) : 0
          const totalFunnelRevenue = planInfo.features.period_comparison ? (comparisonData.current.faturamento ?? 0) : 0
          const leadsByIdx = distributeByClicks(allSourcesRaw, totalFunnelLeads)
          const revenueByIdx = distributeByClicks(allSourcesRaw, totalFunnelRevenue)
          const sourceRevenue: Record<string, number> = {}
          const allSources: SourceEntry[] = allSourcesRaw.map((s, idx) => {
            const attributedLeads = totalFunnelLeads > 0 ? Math.round(leadsByIdx[idx]) : s.leads
            const attributedRevenue = revenueByIdx[idx] ?? 0
            sourceRevenue[s.key] = attributedRevenue
            const roiStr = hasROI(attributedRevenue, s.spend)
              ? calculateROI(attributedRevenue, s.spend).toFixed(2).replace('.', ',') + '%'
              : s.roi
            return {
              ...s,
              leads: Math.max(0, attributedLeads),
              roi: roiStr,
            }
          })

          const visibleSources = selectedSource === 'all'
            ? allSources
            : allSources.filter(s => s.key === selectedSource)

          const anyConnected = allSources.length > 0

          // Totais agregados (sempre soma total, nunca média de médias)
          const totCliques     = visibleSources.reduce((a, s) => a + s.cliques,    0)
          const totImpressoes  = visibleSources.reduce((a, s) => a + s.impressoes, 0)
          const totSpend       = visibleSources.reduce((a, s) => a + s.spend,      0)
          const totLeads       = visibleSources.reduce((a, s) => a + s.leads,      0)
          const totRevenue     = visibleSources.reduce((a, s) => a + (sourceRevenue[s.key] ?? 0), 0)

          const cpcMedio  = calculateCPC(totSpend, totCliques)
          const cpmMedio  = calculateCPM(totSpend, totImpressoes)
          const ctrMedio  = calculateCTR(totCliques, totImpressoes)
          const convRate  = calculateConversion(totLeads, totCliques)
          const roiTotal  = calculateROI(totRevenue, totSpend)
          const roasTotal = calculateROAS(totRevenue, totSpend)
          const roiHigh   = hasROI(totRevenue, totSpend) && roiTotal > 500

          const sourceButtons = [
            { id: 'all',      label: 'Todas' },
            { id: 'facebook', label: 'Meta' },
            { id: 'google',   label: 'Google' },
            { id: 'tiktok',   label: 'TikTok' },
          ] as const

          // Renders a mini per-source breakdown inside a card
          const SourceBreakdown = ({ getValue }: { getValue: (s: typeof visibleSources[0]) => string | null }) => {
            if (visibleSources.length <= 1) return null
            return (
              <div className="mt-1.5 space-y-1 border-t border-gray-200 dark:border-gray-700 pt-1.5">
                {visibleSources.map(s => (
                  <div key={s.key} className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                    <span className={`text-[10px] font-bold ${s.color}`}>{getValue(s) ?? '—'}</span>
                  </div>
                ))}
              </div>
            )
          }

          const neutralColor = 'text-gray-900 dark:text-white'

          // Classes completas (não interpoladas) para o Tailwind conseguir detectar em build.
          const hueBadge: Record<string, string> = {
            blue:    'bg-blue-500/10 text-blue-500 dark:text-blue-400',
            emerald: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
            orange:  'bg-orange-500/10 text-orange-500 dark:text-orange-400',
            violet:  'bg-violet-500/10 text-violet-500 dark:text-violet-400',
            cyan:    'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400',
            teal:    'bg-teal-500/10 text-teal-500 dark:text-teal-400',
            amber:   'bg-amber-500/10 text-amber-500 dark:text-amber-400',
            red:     'bg-red-500/10 text-red-500 dark:text-red-400',
            green:   'bg-green-500/10 text-green-500 dark:text-green-400',
            purple:  'bg-purple-500/10 text-purple-500 dark:text-purple-400',
            gray:    'bg-gray-500/10 text-gray-500 dark:text-gray-400',
          }
          const hueTopBorder: Record<string, string> = {
            blue:    'border-t-blue-500',
            emerald: 'border-t-emerald-500',
            orange:  'border-t-orange-500',
            violet:  'border-t-violet-500',
            cyan:    'border-t-cyan-500',
            teal:    'border-t-teal-500',
            amber:   'border-t-amber-500',
            red:     'border-t-red-500',
            green:   'border-t-green-500',
            purple:  'border-t-purple-500',
            gray:    'border-t-gray-300 dark:border-t-gray-600',
          }
          const roiHue = !hasROI(totRevenue, totSpend)
            ? 'gray'
            : roiTotal < 0 ? 'red' : roiTotal < 100 ? 'amber' : roiTotal < 500 ? 'green' : 'purple'

          const kpis = [
            {
              label: 'Total de Cliques', icon: <MousePointer2 className="w-4 h-4" />, hue: 'blue' as const, color: neutralColor,
              value: anyConnected && visibleSources.length > 0 ? totCliques.toLocaleString('pt-BR') : null,
              breakdown: <SourceBreakdown getValue={s => s.cliques.toLocaleString('pt-BR')} />,
            },
            {
              label: 'Total de Impressões', icon: <Eye className="w-4 h-4" />, hue: 'emerald' as const, color: neutralColor,
              value: anyConnected && visibleSources.length > 0 ? totImpressoes.toLocaleString('pt-BR') : null,
              breakdown: <SourceBreakdown getValue={s => s.impressoes.toLocaleString('pt-BR')} />,
            },
            {
              label: 'Total de Leads', icon: <Target className="w-4 h-4" />, hue: 'orange' as const, color: neutralColor,
              value: (totLeads > 0 || (anyConnected && visibleSources.length > 0)) ? totLeads.toLocaleString('pt-BR') : null,
              breakdown: <SourceBreakdown getValue={s => s.leads.toLocaleString('pt-BR')} />,
            },
            {
              label: 'Taxa de Conversão', icon: <TrendingUp className="w-4 h-4" />, hue: 'violet' as const, color: neutralColor,
              value: num(convRate, '', '%'),
              breakdown: <SourceBreakdown getValue={s => {
                const r = s.cliques > 0 ? (s.leads / s.cliques) * 100 : null
                return num(r, '', '%')
              }} />,
            },
            {
              label: 'CPC Médio', icon: <DollarSign className="w-4 h-4" />, hue: 'cyan' as const, color: neutralColor,
              value: num(cpcMedio, 'R$ '),
              breakdown: <SourceBreakdown getValue={s => num(calculateCPC(s.spend, s.cliques), 'R$ ')} />,
            },
            {
              label: 'CPM Médio', icon: <BarChart3 className="w-4 h-4" />, hue: 'teal' as const, color: neutralColor,
              value: num(cpmMedio, 'R$ '),
              breakdown: <SourceBreakdown getValue={s => num(calculateCPM(s.spend, s.impressoes), 'R$ ')} />,
            },
            {
              label: 'CTR Médio', icon: <Zap className="w-4 h-4" />, hue: 'amber' as const, color: neutralColor,
              value: num(ctrMedio, '', '%'),
              breakdown: <SourceBreakdown getValue={s => num(calculateCTR(s.cliques, s.impressoes), '', '%')} />,
            },
            {
              label: 'ROI Geral', icon: <Trophy className="w-4 h-4" />, hue: roiHue,
              color: hasROI(totRevenue, totSpend)
                ? (roiTotal < 0
                    ? 'text-red-500 dark:text-red-400'
                    : roiTotal < 100
                      ? 'text-amber-500 dark:text-amber-400'
                      : roiTotal < 500
                        ? 'text-green-500 dark:text-green-400'
                        : 'text-purple-500 dark:text-purple-400')
                : neutralColor,
              value: hasROI(totRevenue, totSpend) ? roiTotal.toFixed(2).replace('.', ',') + '%' : null,
              breakdown: hasROI(totRevenue, totSpend) ? (
                <div className="mt-1.5 space-y-1 border-t border-gray-200 dark:border-gray-700 pt-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-gray-400">ROAS</span>
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{roasTotal.toFixed(2).replace('.', ',')}x</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    Para cada R$1 investido, seu funil gerou R${roasTotal.toFixed(2).replace('.', ',')} em receita
                  </p>
                  {roiHigh && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight flex items-start gap-1">
                      <AlertTriangle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
                      <span>Resultados acima da média. Verifique se todas as fontes de custo e receita estão corretamente integradas.</span>
                    </p>
                  )}
                </div>
              ) : <SourceBreakdown getValue={s => s.roi} />,
            },
          ]

          return (
            <div className="mb-6">
              {/* Header + seletor de fonte */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5 text-gray-400" />Resumo Geral
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">— fontes conectadas</span>

                {sourceButtons.map(btn => {
                  const isConnected = btn.id === 'all'
                    ? anyConnected
                    : allSources.some(s => s.key === btn.id)
                  return (
                    <button
                      key={btn.id}
                      onClick={() => setSelectedSource(btn.id)}
                      disabled={!isConnected && btn.id !== 'all'}
                      title={!isConnected && btn.id !== 'all' ? 'Integração não conectada' : undefined}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border
                        ${selectedSource === btn.id
                          ? 'bg-gray-700 border-gray-700 text-white'
                          : isConnected || btn.id === 'all'
                            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                    >
                      {btn.label}
                      {isConnected && btn.id !== 'all' && (
                        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-gray-400 align-middle" />
                      )}
                    </button>
                  )
                })}
              </div>

              {anyConnected ? (() => {
                // Métricas que respondem "meu funil está funcionando?" ganham destaque;
                // as demais são detalhes de mídia paga e ficam numa faixa secundária.
                const featuredLabels = ['Taxa de Conversão', 'ROI Geral']
                const featuredKpis = kpis.filter(k => featuredLabels.includes(k.label))
                const secondaryKpis = kpis.filter(k => !featuredLabels.includes(k.label))

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {featuredKpis.map(({ label, value, icon, color, breakdown, hue }) => (
                        <div
                          key={label}
                          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-2 ${hueTopBorder[hue]} rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-1.5 hover:scale-[1.03] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
                        >
                          <div className="flex items-center gap-2.5 mb-3">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${hueBadge[hue]}`}>
                              {icon}
                            </span>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              {label}
                            </p>
                          </div>
                          {value !== null ? (
                            <>
                              <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
                              {breakdown}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic font-medium">
                              Sem dados
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {secondaryKpis.map(({ label, value, icon, color, breakdown, hue }) => (
                        <div
                          key={label}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-1.5 hover:scale-[1.04] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 ${hueBadge[hue]}`}>
                              {icon}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                          </div>
                          {value !== null ? (
                            <>
                              <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                              {breakdown}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic font-medium">
                              Sem dados
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })() : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Plug2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        Conecte uma fonte de tráfego para ver suas métricas
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Cliques, impressões, leads, conversão, CPC, CPM, CTR e ROI aparecem aqui assim que Meta, Google ou TikTok Ads estiverem conectados.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href="/facebook-connect"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition whitespace-nowrap"
                      >
                        Conectar Meta Ads
                      </Link>
                      <Link
                        href="/settings"
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap"
                      >
                        Ver integrações <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Aviso "WhatsApp no funil" (abaixo do Resumo Geral) */}
        {(() => {
          const isProOrScale = planInfo.plan === 'PRO' || planInfo.plan === 'SCALE'
          const hasWhatsApp = (whatsappData as any)?.connected
          const realConversations = (whatsappData as any)?.raw?.conversations
            ?? (whatsappData as any)?.conversations
            ?? null

          const title = isProOrScale
            ? (hasWhatsApp ? 'Conversas iniciadas via WhatsApp Business' : 'Conecte seu WhatsApp Business para ver dados reais')
            : 'Conversas iniciadas estimadas a partir dos cliques'

          const description = isProOrScale
            ? (hasWhatsApp
                ? 'Métricas reais da conexão oficial do WhatsApp Business com a API da Meta.'
                : 'Seu plano libera a conexão oficial. Conecte sua conta verificada em Meus Números para ver métricas reais.')
            : 'No Start, usamos estimativa por clique. Métricas detalhadas do WhatsApp exigem Pro ou Scale com conta verificada.'

          const valueLabel = isProOrScale && hasWhatsApp ? 'Total atual' : 'Estimativa atual'
          const value = isProOrScale && hasWhatsApp && realConversations != null
            ? realConversations
            : estimatedWhatsAppConversations

          return (
            <div className="mb-6 rounded-2xl border border-blue-200/70 dark:border-blue-900/50 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">WhatsApp no funil</p>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">{title}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{valueLabel}</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Monitoramento proativo — insights gerados pela SaraObserver */}
        <div className="mb-6">
          <SaraInsightsPanel />
        </div>

        {/* Sugestões da Sara.ai */}
        <div className="mt-8">
          <AISuggestions
            metrics={{
            whatsapp: whatsappData,
              facebook: facebookData,
              hotmart: hotmartData,
            }}
          />
        </div>
      </main>

      {/* Modal de Análise Detalhada por Card */}
      <CardInsightModal
        cardType={insightModal?.cardType ?? null}
        cardData={insightModal?.data ?? null}
        onClose={() => setInsightModal(null)}
      />
    </div>
  )
}
