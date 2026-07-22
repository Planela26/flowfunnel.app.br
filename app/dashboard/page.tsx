"use client";
import UserMenu from '@/components/UserMenu'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { MessageCircle, Settings, Download } from 'lucide-react'
import { useFunnelView } from '@/hooks/useFunnelView'
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

const estimateWhatsAppConversations = (clicks: number) => Math.max(0, Math.round(clicks * 0.18))

export default function Dashboard() {
  const { info: planInfo } = usePlan()
  const [viewMode, setViewMode] = useState<'produtor' | 'gestor'>('gestor')
  const [insightModal, setInsightModal] = useState<{ cardType: string; data: any } | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('7days')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const { data: session } = useSession()
  const userId = session?.user?.id as string | undefined
  const { visibleIds, addCard, removeCard } = useFunnelView(userId)
  const [whatsappData, setWhatsappData] = useState<any>(null)
  const [facebookData, setFacebookData] = useState<any>(null)
  const [googleData, setGoogleData] = useState<any>(null)
  const [tiktokData, setTiktokData] = useState<any>(null)
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
  const [loadingHotmart, setLoadingHotmart] = useState(true)
  const [loadingKiwify, setLoadingKiwify] = useState(true)
  const [loadingEduzz, setLoadingEduzz] = useState(true)
  const [loadingMonetizze, setLoadingMonetizze] = useState(true)
  const [loadingStripe, setLoadingStripe] = useState(true)
  const [loadingMercadopago, setLoadingMercadopago] = useState(true)
  const [loadingCrm, setLoadingCrm] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedSource, setSelectedSource] = useState<'all' | 'facebook' | 'google' | 'tiktok'>('all')
  const estimatedWhatsAppConversations = estimateWhatsAppConversations(facebookData?.cliques || 0)

  // Buscar dados reais do WhatsApp — filtra pelo workspace ativo
  const fetchWhatsAppMetrics = useCallback(async () => {
    try {
      setLoadingWhatsApp(true)
      let url = '/api/whatsapp/metrics'
      if (activeWorkspace?.whatsappIntegrationId) {
        url += `?integrationId=${activeWorkspace.whatsappIntegrationId}`
      }
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setWhatsappData(data)
      } else {
        setWhatsappData(null)
      }
    } catch (error) {
      console.error('Erro ao buscar métricas WhatsApp:', error)
      setWhatsappData(null)
    } finally {
      setLoadingWhatsApp(false)
    }
  }, [activeWorkspace?.whatsappIntegrationId])

  useEffect(() => {
    fetchWhatsAppMetrics();
    const interval = setInterval(fetchWhatsAppMetrics, 300000);
    return () => clearInterval(interval);
  }, [fetchWhatsAppMetrics]);

  // Buscar dados reais do Facebook — filtra pelo workspace ativo (campanha vinculada)
  useEffect(() => {
    const fetchFacebookMetrics = async () => {
      try {
        setLoadingFacebook(true)
        const periodMap: Record<string, string> = {
          'today': 'today',
          '7days': 'last_7d',
          '30days': 'last_30d',
        }
        const period = periodMap[selectedPeriod] || 'last_30d'
        // Prioridade: campanha do workspace > campanha selecionada manualmente
        const campaignId = activeWorkspace?.facebookCampaignId || selectedCampaign
        let url = `/api/facebook/metrics?period=${period}`
        if (campaignId) url += `&campaignId=${campaignId}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setFacebookData(data)
        } else {
          setFacebookData(null)
        }
      } catch (error) {
        console.error('Erro ao buscar métricas Facebook:', error)
        setFacebookData(null)
      } finally {
        setLoadingFacebook(false)
      }
    }

    fetchFacebookMetrics()
  }, [selectedPeriod, selectedCampaign, activeWorkspace?.facebookCampaignId])

  // Buscar dados de Google Ads e TikTok Ads
  useEffect(() => {
    const periodMap2: Record<string, string> = { today: 'today', '7days': 'last_7d', '30days': 'last_30d' }
    const period = periodMap2[selectedPeriod] || 'last_30d'
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
  const periodMap: Record<string, string> = {
    'today': 'today',
    '7days': 'last_7d',
    '30days': 'last_30d',
  }
  const period = periodMap[selectedPeriod] || 'last_30d'
  const campaignParam = selectedCampaign ? `&campaignId=${selectedCampaign}` : ''

  // Buscar dados reais do Hotmart
  useEffect(() => {
    const fetchHotmartMetrics = async () => {
      try {
        setLoadingHotmart(true)
        const response = await fetch('/api/hotmart/metrics')
        if (response.ok) {
          const data = await response.json()
          setHotmartData(data)
        } else {
          setHotmartData(null)
        }
      } catch (error) {
        console.error('Erro ao buscar métricas Hotmart:', error)
        setHotmartData(null)
      } finally {
        setLoadingHotmart(false)
      }
    }

    fetchHotmartMetrics()
    const interval = setInterval(fetchHotmartMetrics, 300000) // 5 minutos
    return () => clearInterval(interval)
  }, [])

  // Buscar dados reais do Kiwify
  useEffect(() => {
    const fetchKiwifyMetrics = async () => {
      try {
        setLoadingKiwify(true)
        const response = await fetch('/api/kiwify/metrics')
        if (response.ok) {
          const data = await response.json()
          setKiwifyData(data)
        } else {
          setKiwifyData(null)
        }
      } catch {
        setKiwifyData(null)
      } finally {
        setLoadingKiwify(false)
      }
    }
    fetchKiwifyMetrics()
    const interval = setInterval(fetchKiwifyMetrics, 300000)
    return () => clearInterval(interval)
  }, [])

  // Fetch Eduzz metrics
  useEffect(() => {
    const fetchEduzzMetrics = async () => {
      try {
        setLoadingEduzz(true)
        const response = await fetch('/api/eduzz/metrics')
        if (response.ok) {
          const data = await response.json()
          setEduzzData(data)
        } else {
          setEduzzData(null)
        }
      } catch {
        setEduzzData(null)
      } finally {
        setLoadingEduzz(false)
      }
    }
    fetchEduzzMetrics()
    const interval = setInterval(fetchEduzzMetrics, 300000)
    return () => clearInterval(interval)
  }, [])

  // Fetch Monetizze metrics
  useEffect(() => {
    const fetchMonetizzeMetrics = async () => {
      try {
        setLoadingMonetizze(true)
        const response = await fetch('/api/monetizze/metrics')
        if (response.ok) {
          const data = await response.json()
          setMonetizzeData(data)
        } else {
          setMonetizzeData(null)
        }
      } catch {
        setMonetizzeData(null)
      } finally {
        setLoadingMonetizze(false)
      }
    }
    fetchMonetizzeMetrics()
    const interval = setInterval(fetchMonetizzeMetrics, 300000)
    return () => clearInterval(interval)
  }, [])

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
    const periodMap: Record<string, string> = {
      '7days': '7d', '30days': '30d', '90days': '90d',
      'thismonth': 'month', 'lastmonth': 'lastmonth',
    }
    const p = periodMap[selectedPeriod] || '30d'
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

      {/* Header — mobile only (simplificado) */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-blue-100 dark:border-gray-700 transition-colors lg:hidden">
        <div className="container mx-auto pl-14 pr-4 py-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-extrabold text-blue-900 dark:text-white tracking-tight leading-none">FlowFunnel</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <PlanBadge />
              <UserMenu />
            </div>
          </div>
          {/* Ações rápidas — scroll horizontal no mobile */}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <Link href="/whatsapp-numbers" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg font-medium whitespace-nowrap">
              📱 WhatsApp
            </Link>
            <Link href="/campaigns" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg font-medium whitespace-nowrap">
              📢 Campanhas
            </Link>
            <Link href="/analytics" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded-lg font-medium whitespace-nowrap">
              📊 Analytics
            </Link>
            <button onClick={handleExportCSV} className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium whitespace-nowrap">
              <Download className="w-3 h-3" /> CSV
            </button>
            <Link href="/settings" className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium whitespace-nowrap">
              <Settings className="w-3 h-3" /> Config
            </Link>
          </div>
        </div>
      </header>

      {/* Abas de Funis/Workspaces */}
      <WorkspaceTabs onWorkspaceChange={handleWorkspaceChange} />

      <main className="container mx-auto px-4 py-4">
        {/* Workflow Canvas — funil visual interativo (topo) */}
        <div className="mb-6">
          <FunnelFlow
            visibleIds={visibleIds}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            dataMap={{
              facebook: facebookData,
              google: googleData,
              tiktok: tiktokData,
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
          />
        </div>

        {/* Aviso "WhatsApp no funil" (movido pra baixo do funil) */}
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
          const kpis = [
            {
              label: 'Total de Cliques', icon: '🖱️', color: neutralColor,
              value: anyConnected && visibleSources.length > 0 ? totCliques.toLocaleString('pt-BR') : null,
              breakdown: <SourceBreakdown getValue={s => s.cliques.toLocaleString('pt-BR')} />,
            },
            {
              label: 'Total de Impressões', icon: '👁️', color: neutralColor,
              value: anyConnected && visibleSources.length > 0 ? totImpressoes.toLocaleString('pt-BR') : null,
              breakdown: <SourceBreakdown getValue={s => s.impressoes.toLocaleString('pt-BR')} />,
            },
            {
              label: 'Total de Leads', icon: '🎯', color: neutralColor,
              value: (totLeads > 0 || (anyConnected && visibleSources.length > 0)) ? totLeads.toLocaleString('pt-BR') : null,
              breakdown: <SourceBreakdown getValue={s => s.leads.toLocaleString('pt-BR')} />,
            },
            {
              label: 'Taxa de Conversão', icon: '📈', color: neutralColor,
              value: num(convRate, '', '%'),
              breakdown: <SourceBreakdown getValue={s => {
                const r = s.cliques > 0 ? (s.leads / s.cliques) * 100 : null
                return num(r, '', '%')
              }} />,
            },
            {
              label: 'CPC Médio', icon: '💰', color: neutralColor,
              value: num(cpcMedio, 'R$ '),
              breakdown: <SourceBreakdown getValue={s => num(calculateCPC(s.spend, s.cliques), 'R$ ')} />,
            },
            {
              label: 'CPM Médio', icon: '📊', color: neutralColor,
              value: num(cpmMedio, 'R$ '),
              breakdown: <SourceBreakdown getValue={s => num(calculateCPM(s.spend, s.impressoes), 'R$ ')} />,
            },
            {
              label: 'CTR Médio', icon: '⚡', color: neutralColor,
              value: num(ctrMedio, '', '%'),
              breakdown: <SourceBreakdown getValue={s => num(calculateCTR(s.cliques, s.impressoes), '', '%')} />,
            },
            {
              label: 'ROI Geral', icon: '🏆',
              color: hasROI(totRevenue, totSpend)
                ? (roiTotal < 0
                    ? 'text-red-500 dark:text-red-400'
                    : roiTotal < 100
                      ? 'text-amber-500 dark:text-amber-400'
                      : roiTotal < 500
                        ? 'text-green-500 dark:text-green-400'
                        : 'text-green-600 dark:text-green-500')
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
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                      ⚠️ Resultados acima da média. Verifique se todas as fontes de custo e receita estão corretamente integradas.
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
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">📌 Resumo Geral</span>
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpis.map(({ label, value, icon, color, breakdown }) => (
                  <div key={label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <span>{icon}</span>{label}
                    </p>
                    {value !== null ? (
                      <>
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        {breakdown}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic font-medium">
                        {anyConnected ? 'Sem dados' : 'Sem integrações'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Sugestões do ChatGPT-4 */}
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
