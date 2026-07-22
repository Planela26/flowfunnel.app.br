'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  DollarSign,
  MousePointer,
  Eye,
  Play,
  Pause,
  Archive,
  Star,
  StarOff,
  ExternalLink,
  AlertCircle,
  BarChart3,
  Search,
} from 'lucide-react'

type Source = 'facebook' | 'google' | 'tiktok'

interface Campaign {
  id: string
  campaignId: string
  name: string
  status: string
  isActive: boolean
  isDefault: boolean
  objective?: string
  budget?: number
  spend: number
  startDate?: string
  endDate?: string
  lastSyncedAt: string
}

interface CampaignMetrics {
  impressions: number
  clicks: number
  spend: number
  ctr: string
  cpc: string
  roi: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:   { label: 'Ativa',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: <Play    className="w-3 h-3" /> },
  PAUSED:   { label: 'Pausada',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Pause   className="w-3 h-3" /> },
  ARCHIVED: { label: 'Arquivada', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',           icon: <Archive className="w-3 h-3" /> },
}

const SOURCES: { id: Source; label: string; color: string; logo: React.ReactNode; connectHref: string; platform: string }[] = [
  {
    id: 'facebook',
    label: 'Facebook Ads',
    color: 'bg-blue-600',
    logo: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    connectHref: '/settings#facebook',
    platform: 'META_ADS',
  },
  {
    id: 'google',
    label: 'Google Ads',
    color: 'bg-white border border-gray-200',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    connectHref: '/settings#google',
    platform: 'GOOGLE_ADS',
  },
  {
    id: 'tiktok',
    label: 'TikTok Ads',
    color: 'bg-black',
    logo: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.73a8.27 8.27 0 004.83 1.54V6.82a4.85 4.85 0 01-1.06-.13z"/>
      </svg>
    ),
    connectHref: '/settings#tiktok',
    platform: 'TIKTOK_ADS',
  },
]

export default function CampaignsPage() {
  const [activeSource, setActiveSource] = useState<Source>('facebook')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [notConnected, setNotConnected] = useState(false)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<Record<Source, boolean>>({
    facebook: false, google: false, tiktok: false,
  })

  const checkConnections = useCallback(async () => {
    try {
      const [fbRes, ggRes, ttRes] = await Promise.all([
        fetch('/api/integrations/meta').catch(() => null),
        fetch('/api/integrations/google').catch(() => null),
        fetch('/api/integrations/tiktok').catch(() => null),
      ])
      const [fbData, ggData, ttData] = (await Promise.all([
        fbRes?.json().catch(() => ({})) ?? {},
        ggRes?.json().catch(() => ({})) ?? {},
        ttRes?.json().catch(() => ({})) ?? {},
      ])) as Array<{ connected?: boolean } | null | undefined>
      setConnectionStatus({
        facebook: fbData?.connected ?? false,
        google:   ggData?.connected ?? false,
        tiktok:   ttData?.connected ?? false,
      })
    } catch {}
  }, [])

  const fetchCampaigns = useCallback(async (forceSync = false) => {
    if (activeSource !== 'facebook') {
      setLoading(false)
      setCampaigns([])
      return
    }
    try {
      if (forceSync) setSyncing(true)
      else setLoading(true)
      const url = forceSync ? '/api/campaigns?sync=true' : '/api/campaigns'
      const res = await fetch(url)
      const data = await res.json()
      if (data.campaigns && data.campaigns.length > 0) {
        setCampaigns(data.campaigns)
        setNotConnected(false)
        const def = data.campaigns.find((c: Campaign) => c.isDefault)
        if (def && !selectedCampaign) setSelectedCampaign(def)
      } else {
        setCampaigns([])
        setNotConnected(true)
      }
    } catch {
      setNotConnected(true)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [activeSource, selectedCampaign])

  const fetchMetrics = useCallback(async (campaign: Campaign) => {
    setLoadingMetrics(true)
    setMetrics(null)
    try {
      const res = await fetch(`/api/facebook/metrics?period=last_7d&campaignId=${campaign.campaignId}`)
      const data = await res.json()
      if (data && !data.error) {
        const raw = data.raw || data.data || {}
        setMetrics({
          impressions: raw.impressions ?? 0,
          clicks:      raw.clicks ?? data.cliques ?? 0,
          spend:       raw.spend ?? 0,
          ctr:         data.ctr ?? '0%',
          cpc:         data.cpc ?? 'R$ 0,00',
          roi:         data.roi ?? 'N/D',
        })
      }
    } catch {}
    finally { setLoadingMetrics(false) }
  }, [])

  const setDefault = async (campaign: Campaign) => {
    setSettingDefault(campaign.id)
    try {
      await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      })
      setCampaigns((prev) => prev.map((c) => ({ ...c, isDefault: c.id === campaign.id })))
    } catch {}
    finally { setSettingDefault(null) }
  }

  useEffect(() => {
    checkConnections()
  }, [checkConnections])

  useEffect(() => {
    setSelectedCampaign(null)
    setMetrics(null)
    setSearch('')
    setFilterStatus('ALL')
    fetchCampaigns()
  }, [activeSource])

  useEffect(() => {
    if (selectedCampaign && activeSource === 'facebook') fetchMetrics(selectedCampaign)
  }, [selectedCampaign, fetchMetrics, activeSource])

  const filtered = campaigns.filter((c) => {
    const matchStatus = filterStatus === 'ALL' || c.status === filterStatus
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const currentSource = SOURCES.find(s => s.id === activeSource)!

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm flex-shrink-0">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">FlowFunnel</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Campanhas</p>
            </div>
          </div>
          {activeSource === 'facebook' && (
            <button
              onClick={() => fetchCampaigns(true)}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>

        {/* Source tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0">
          {SOURCES.map((src) => (
            <button
              key={src.id}
              onClick={() => setActiveSource(src.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeSource === src.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${src.color}`}>
                {src.logo}
              </div>
              {src.label}
              {connectionStatus[src.id] && (
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Conectado" />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Not connected state for non-facebook sources */}
        {activeSource !== 'facebook' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${currentSource.color}`}>
              {currentSource.logo}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {connectionStatus[activeSource] ? `${currentSource.label} Conectado` : `${currentSource.label} não conectado`}
            </h2>
            {connectionStatus[activeSource] ? (
              <>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                  Sua conta está conectada. A sincronização de campanhas do {currentSource.label} estará disponível em breve.
                </p>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium">
                  ✅ Conta conectada — em breve com sincronização automática
                </span>
              </>
            ) : (
              <>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                  Conecte sua conta do {currentSource.label} para sincronizar campanhas e visualizar métricas diretamente no FlowFunnel.
                </p>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Conectar {currentSource.label} <ExternalLink className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        )}

        {/* Facebook campaigns */}
        {activeSource === 'facebook' && (
          <>
            {/* Not connected banner */}
            {notConnected && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6 flex items-start gap-4 mb-6">
                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-yellow-800 dark:text-yellow-300">Facebook Ads não conectado</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    Conecte sua conta de anúncios para sincronizar campanhas e ver métricas detalhadas.
                  </p>
                  <Link href="/settings" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                    Conectar Facebook Ads <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Carregando campanhas...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Campaign list */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar campanha..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        {['ALL', 'ACTIVE', 'PAUSED'].map((s) => (
                          <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                              filterStatus === s
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {s === 'ALL' ? 'Todas' : s === 'ACTIVE' ? 'Ativas' : 'Pausadas'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[560px] overflow-y-auto">
                      {filtered.length === 0 ? (
                        <div className="py-10 text-center text-gray-400 dark:text-gray-500">
                          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">{campaigns.length === 0 ? 'Nenhuma campanha encontrada' : 'Sem resultados para o filtro'}</p>
                        </div>
                      ) : (
                        filtered.map((c) => {
                          const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.ARCHIVED
                          const isSelected = selectedCampaign?.id === c.id
                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCampaign(c)}
                              className={`p-4 cursor-pointer transition ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                                    {c.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                                      {st.icon} {st.label}
                                    </span>
                                    {c.isDefault && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        <Star className="w-3 h-3" /> Padrão
                                      </span>
                                    )}
                                  </div>
                                  {c.spend > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                      💸 R$ {c.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} investido
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDefault(c) }}
                                  disabled={settingDefault === c.id || c.isDefault}
                                  className={`shrink-0 p-1.5 rounded-lg transition ${
                                    c.isDefault
                                      ? 'text-blue-500 cursor-default'
                                      : 'text-gray-300 dark:text-gray-600 hover:text-yellow-500 dark:hover:text-yellow-400'
                                  }`}
                                  title={c.isDefault ? 'Campanha padrão do dashboard' : 'Definir como padrão no dashboard'}
                                >
                                  {c.isDefault ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Campaign details */}
                <div className="lg:col-span-2">
                  {!selectedCampaign ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 h-64 flex items-center justify-center">
                      <div className="text-center text-gray-400 dark:text-gray-500">
                        <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">Selecione uma campanha para ver os detalhes</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCampaign.name}</h2>
                              {selectedCampaign.isDefault && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                                  <Star className="w-3 h-3" /> Padrão no Dashboard
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">ID: {selectedCampaign.campaignId}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(() => {
                              const st = STATUS_CONFIG[selectedCampaign.status] || STATUS_CONFIG.ARCHIVED
                              return (
                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${st.color}`}>
                                  {st.icon} {st.label}
                                </span>
                              )
                            })()}
                            {!selectedCampaign.isDefault && (
                              <button
                                onClick={() => setDefault(selectedCampaign)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-300 rounded-full transition"
                              >
                                <Star className="w-3.5 h-3.5" /> Definir como padrão
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          {selectedCampaign.objective && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                              <div className="text-xs text-gray-500 dark:text-gray-400">Objetivo</div>
                              <div className="font-semibold text-gray-900 dark:text-white mt-0.5">{selectedCampaign.objective}</div>
                            </div>
                          )}
                          {selectedCampaign.budget && selectedCampaign.budget > 0 && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                              <div className="text-xs text-gray-500 dark:text-gray-400">Orçamento</div>
                              <div className="font-semibold text-gray-900 dark:text-white mt-0.5">
                                R$ {selectedCampaign.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          {selectedCampaign.startDate && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                              <div className="text-xs text-gray-500 dark:text-gray-400">Início</div>
                              <div className="font-semibold text-gray-900 dark:text-white mt-0.5">
                                {new Date(selectedCampaign.startDate).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          Métricas — Últimos 7 dias
                        </h3>
                        {loadingMetrics ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                          </div>
                        ) : metrics ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {[
                              { icon: <Eye className="w-4 h-4" />,          label: 'Impressões', value: metrics.impressions.toLocaleString('pt-BR'),                                           color: 'text-blue-600' },
                              { icon: <MousePointer className="w-4 h-4" />, label: 'Cliques',    value: metrics.clicks.toLocaleString('pt-BR'),                                               color: 'text-indigo-600' },
                              { icon: <DollarSign className="w-4 h-4" />,   label: 'Investido',  value: `R$ ${metrics.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,          color: 'text-red-500' },
                              { icon: <BarChart3 className="w-4 h-4" />,    label: 'CTR',        value: metrics.ctr,                                                                          color: 'text-purple-600' },
                              { icon: <MousePointer className="w-4 h-4" />, label: 'CPC',        value: metrics.cpc,                                                                          color: 'text-orange-500' },
                              { icon: <TrendingUp className="w-4 h-4" />,   label: 'ROI',        value: metrics.roi,                                                                          color: 'text-green-600' },
                            ].map((m) => (
                              <div key={m.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                <div className={`flex items-center gap-1.5 ${m.color} mb-2`}>
                                  {m.icon}
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{m.label}</span>
                                </div>
                                <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhuma métrica disponível para esta campanha</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                        <Star className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Campanha Padrão do Dashboard</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                            A campanha marcada com ⭐ aparece selecionada automaticamente no dashboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
