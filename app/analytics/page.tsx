'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TrendChart from '@/components/charts/TrendChart'
import ComparisonChart from '@/components/charts/ComparisonChart'
import FunnelVisualization from '@/components/charts/FunnelVisualization'
import DateFilter from '@/components/DateFilter'
import { MessageCircle } from 'lucide-react'

interface MetricsData {
  whatsapp: {
    conversations: number
    messages: number
    responseRate: number
  }
  facebook: {
    clicks: number
    impressions: number
    ctr: number
    cpc: number
    spend: number
  }
  hotmart: {
    sales: number
    revenue: number
    checkouts: number
    conversionRate: number
  }
}

interface TrendData {
  date: string
  cliques: number
  conversas: number
  vendas: number
  receita: number
  [key: string]: string | number
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<MetricsData>({
    whatsapp: { conversations: 0, messages: 0, responseRate: 0 },
    facebook: { clicks: 0, impressions: 0, ctr: 0, cpc: 0, spend: 0 },
    hotmart: { sales: 0, revenue: 0, checkouts: 0, conversionRate: 0 },
  })
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [platformPerformance, setPlatformPerformance] = useState<Array<{
    name: string; gasto: number; receita: number; lucro: number; roi: number; cliques: number
  }>>([])
  const [dateRange, setDateRange] = useState<{
    startDate: Date | null
    endDate: Date | null
    period: string
  }>({
    startDate: null,
    endDate: null,
    period: 'last7days',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const days = dateRange.period === 'last7days' ? 7 : dateRange.period === 'last30days' ? 30 : 7
        const [whatsappRes, facebookRes, hotmartRes, timeseriesRes, platformRes] = await Promise.all([
          fetch('/api/whatsapp/metrics'),
          fetch('/api/facebook/metrics'),
          fetch('/api/hotmart/metrics'),
          fetch(`/api/analytics/timeseries?days=${days}`),
          fetch(`/api/analytics/platform-performance?days=${days}`),
        ])
        const whatsapp = await whatsappRes.json()
        const facebook = await facebookRes.json()
        const hotmart = await hotmartRes.json()
        const timeseries = await timeseriesRes.json()
        const platformPerf = await platformRes.json()
        setMetrics({
          whatsapp: whatsapp.data || { conversations: 0, messages: 0, responseRate: 0 },
          facebook: facebook.data || { clicks: 0, impressions: 0, ctr: 0, cpc: 0, spend: 0 },
          hotmart: hotmart.data || { sales: 0, revenue: 0, checkouts: 0, conversionRate: 0 },
        })
        if (timeseries?.data && !timeseries.empty) {
          setTrendData(timeseries.data)
        }
        if (platformPerf?.data) {
          setPlatformPerformance(platformPerf.data)
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, dateRange])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando análises...</p>
        </div>
      </div>
    )
  }

  const funnelData = [
    { name: 'Impressões', value: metrics.facebook.impressions, color: '#3b82f6' },
    { name: 'Cliques', value: metrics.facebook.clicks, color: '#10b981' },
    { name: 'Conversas', value: metrics.whatsapp.conversations, color: '#f59e0b' },
    { name: 'Checkouts', value: metrics.hotmart.checkouts, color: '#ef4444' },
    { name: 'Vendas', value: metrics.hotmart.sales, color: '#8b5cf6' },
  ]

  const comparisonData = [
    {
      name: 'Facebook Ads',
      atual: metrics.facebook.clicks,
      anterior: 0,
    },
    {
      name: 'WhatsApp',
      atual: metrics.whatsapp.conversations,
      anterior: 0,
    },
    {
      name: 'Hotmart',
      atual: metrics.hotmart.sales,
      anterior: 0,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-blue-900 dark:text-white tracking-tight leading-none">FlowFunnel</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                ← Dashboard
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                ⚙️ Configurações
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros de Data */}
        <div className="mb-8">
          <DateFilter
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            period={dateRange.period}
            onFilterChange={(start, end, period) => {
              setDateRange({ startDate: start, endDate: end, period })
            }}
          />
        </div>

        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Impressões</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {metrics.facebook.impressions.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Sem dados de comparação</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cliques</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {metrics.facebook.clicks.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Sem dados de comparação</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Conversas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {metrics.whatsapp.conversations.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Sem dados de comparação</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {metrics.hotmart.sales.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Sem dados de comparação</p>
          </div>
        </div>

        {/* Visualização do Funil */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Visualização do Funil</h2>
          <FunnelVisualization title="Funil de Conversão" stages={funnelData} />
        </div>

        {/* Gráficos de Tendência e Comparação */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Tendência de Performance</h2>
            <TrendChart 
              title="Tendência de Performance"
              data={trendData}
              lines={[ 
                { dataKey: 'cliques',   name: '📘 Cliques (Ads)',     color: '#3b82f6' },
                { dataKey: 'conversas', name: '💬 Conversas (WA)',     color: '#22c55e' },
                { dataKey: 'vendas',    name: '🛒 Vendas (Checkout)',  color: '#f97316' },
              ]}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Investimento vs Receita por Plataforma</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 rounded-sm bg-red-500"></span> Investimento
                </span>
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 rounded-sm bg-green-500"></span> Receita
                </span>
              </div>
            </div>
            <ComparisonChart 
              title=""
              data={platformPerformance.length ? platformPerformance : [
                { name: 'Meta Ads',   gasto: 0, receita: 0 },
                { name: 'Google Ads', gasto: 0, receita: 0 },
                { name: 'TikTok Ads', gasto: 0, receita: 0 },
              ]}
              bars={[ 
                { dataKey: 'gasto',   name: 'Investimento', color: '#ef4444' },
                { dataKey: 'receita', name: 'Receita',      color: '#22c55e' }
              ]}
            />
            {platformPerformance.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                {platformPerformance.map(p => (
                  <div key={p.name} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{p.name}</div>
                    <div className={`font-bold mt-0.5 ${p.lucro >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {p.lucro >= 0 ? '+' : ''}R$ {p.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">ROI {p.roi.toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Métricas Detalhadas por Plataforma */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Facebook Ads */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Facebook Ads</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">CTR</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{metrics.facebook.ctr.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(metrics.facebook.ctr * 10, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">CPC</span>
                  <span className="font-semibold text-gray-900 dark:text-white">R$ {metrics.facebook.cpc.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Gasto Total</span>
                  <span className="font-semibold text-gray-900 dark:text-white">R$ {metrics.facebook.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">WhatsApp</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Taxa de Resposta</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{metrics.whatsapp.responseRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div className="bg-green-600 dark:bg-green-400 h-2 rounded-full" style={{ width: `${metrics.whatsapp.responseRate}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Mensagens</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{metrics.whatsapp.messages.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Média por Conversa</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {metrics.whatsapp.conversations > 0 
                      ? (metrics.whatsapp.messages / metrics.whatsapp.conversations).toFixed(1)
                      : '0'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Hotmart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hotmart</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Taxa de Conversão</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{metrics.hotmart.conversionRate.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div className="bg-orange-600 dark:bg-orange-400 h-2 rounded-full" style={{ width: `${Math.min(metrics.hotmart.conversionRate * 10, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Receita Total</span>
                  <span className="font-semibold text-gray-900 dark:text-white">R$ {metrics.hotmart.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Ticket Médio</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    R$ {metrics.hotmart.sales > 0 
                      ? (metrics.hotmart.revenue / metrics.hotmart.sales).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                      : '0,00'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="mt-8 flex gap-4 justify-center">
          <button className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
            📊 Exportar Relatório
          </button>
          <button className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            📧 Agendar Relatório
          </button>
        </div>
      </div>
    </div>
  )
}
