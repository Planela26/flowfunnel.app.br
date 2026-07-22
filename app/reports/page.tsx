'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Download, RefreshCw, BarChart2, MessageCircle, ShoppingCart,
  DollarSign, Webhook, TrendingUp, Calendar, FileText, AlertCircle
} from 'lucide-react'

interface ReportData {
  period: { days: number; since: string }
  summary: {
    totalWebhooks: number
    totalSales: number
    totalRevenue: number
    waConversas: number
    platforms: number
  }
  byPlatform: Record<string, { total: number; success: number; errors: number; events: string[] }>
  dailySeries: { date: string; count: number }[]
  profitSeries?: { date: string; revenue: number; costs: number; profit: number; roi: number | null }[]
  topEvents: Record<string, number>
}

const PLATFORM_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  HOTMART: 'Hotmart',
  KIWIFY: 'Kiwify',
  META_ADS: 'Facebook Ads',
  FACEBOOK: 'Facebook Ads',
  EDUZZ: 'Eduzz',
  MONETIZZE: 'Monetizze',
}

const PLATFORM_COLORS: Record<string, string> = {
  WHATSAPP: 'bg-green-500',
  HOTMART: 'bg-orange-500',
  KIWIFY: 'bg-emerald-500',
  META_ADS: 'bg-blue-500',
  FACEBOOK: 'bg-blue-500',
  EDUZZ: 'bg-purple-500',
  MONETIZZE: 'bg-pink-500',
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [tab, setTab] = useState<'geral' | 'lucro'>('geral')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?days=${days}`)
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }, [days])

  useEffect(() => { fetchReport() }, [fetchReport])

  const exportCSV = () => {
    if (!data) return

    const lines: string[][] = []

    lines.push(['RELATÓRIO WHATSAPP FUNNEL'])
    lines.push([`Período: últimos ${days} dias`])
    lines.push([`Gerado em: ${new Date().toLocaleString('pt-BR')}`])
    lines.push([])

    lines.push(['RESUMO'])
    lines.push(['Métrica', 'Valor'])
    lines.push(['Total de webhooks', String(data.summary.totalWebhooks)])
    lines.push(['Conversas WhatsApp', String(data.summary.waConversas)])
    lines.push(['Total de vendas', String(data.summary.totalSales)])
    lines.push(['Receita total', `R$ ${data.summary.totalRevenue.toFixed(2)}`])
    lines.push([])

    lines.push(['POR PLATAFORMA'])
    lines.push(['Plataforma', 'Total', 'Sucesso', 'Erros', 'Taxa de sucesso'])
    for (const [platform, stats] of Object.entries(data.byPlatform)) {
      const rate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0'
      lines.push([PLATFORM_LABELS[platform] || platform, String(stats.total), String(stats.success), String(stats.errors), `${rate}%`])
    }
    lines.push([])

    lines.push(['ATIVIDADE DIÁRIA'])
    lines.push(['Data', 'Webhooks'])
    for (const { date, count } of data.dailySeries) {
      lines.push([new Date(date).toLocaleDateString('pt-BR'), String(count)])
    }
    lines.push([])

    lines.push(['TOP EVENTOS'])
    lines.push(['Evento', 'Ocorrências'])
    const sorted = Object.entries(data.topEvents).sort((a, b) => b[1] - a[1]).slice(0, 20)
    for (const [event, count] of sorted) {
      lines.push([event, String(count)])
    }

    const csv = lines.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const exportExcel = () => {
    if (!data) return

    const lines: string[][] = []
    const pushBlank = () => lines.push([])
    const pushSection = (title: string) => {
      lines.push([title])
    }
    const pushTable = (headers: string[], rows: string[][]) => {
      lines.push(headers)
      rows.forEach(row => lines.push(row))
    }

    pushSection('RELATÓRIO FLOWFUNNEL')
    lines.push(['Período', `Últimos ${days} dias`])
    lines.push(['Gerado em', new Date().toLocaleString('pt-BR')])
    pushBlank()

    pushSection('RESUMO EXECUTIVO')
    pushTable(
      ['Métrica', 'Valor'],
      [
        ['Total de webhooks', String(data.summary.totalWebhooks)],
        ['Conversas WhatsApp', String(data.summary.waConversas)],
        ['Total de vendas', String(data.summary.totalSales)],
        ['Receita total', `R$ ${data.summary.totalRevenue.toFixed(2)}`],
      ]
    )
    pushBlank()

    pushSection('POR PLATAFORMA')
    pushTable(
      ['Plataforma', 'Total', 'Sucesso', 'Erros', 'Taxa de sucesso'],
      Object.entries(data.byPlatform).map(([platform, stats]) => {
        const rate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0'
        return [PLATFORM_LABELS[platform] || platform, String(stats.total), String(stats.success), String(stats.errors), `${rate}%`]
      })
    )
    pushBlank()

    pushSection('ATIVIDADE DIÁRIA')
    pushTable(
      ['Data', 'Webhooks'],
      data.dailySeries.map(({ date, count }) => [new Date(date).toLocaleDateString('pt-BR'), String(count)])
    )
    pushBlank()

    pushSection('TOP EVENTOS')
    pushTable(
      ['Evento', 'Ocorrências'],
      Object.entries(data.topEvents)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([event, count]) => [event, String(count)])
    )
    pushBlank()

    pushSection('LUCRO E ROI')
    pushTable(
      ['Indicador', 'Valor'],
      [
        ['Lucro estimado', `R$ ${(data.summary.totalRevenue * 0.7).toFixed(2)}`],
        ['ROI estimado', data.summary.totalRevenue > 0 ? `${((data.summary.totalRevenue / Math.max(1, data.summary.totalWebhooks)) * 100).toFixed(2)}%` : '0%'],
      ]
    )

    const csv = lines.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const maxDaily = data ? Math.max(...data.dailySeries.map(d => d.count), 1) : 1
  const topEvents = data ? Object.entries(data.topEvents).sort((a, b) => b[1] - a[1]).slice(0, 10) : []
  const maxEvent = topEvents[0]?.[1] || 1

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Relatórios
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Análise completa do seu funil
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={15}>Últimos 15 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={60}>Últimos 60 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
                const end = new Date().toISOString()
                window.open(`/api/reports/export-pdf?startDate=${start}&endDate=${end}`, '_blank')
              }}
              disabled={!data}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              Baixar PDF completo
            </button>
            <button
              onClick={exportExcel}
              disabled={!data}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Baixar Excel
            </button>
          </div>
        </div>

        {!data ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado encontrado para o período selecionado.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setTab('geral')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  tab === 'geral'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Visão geral
              </button>
              <button
                onClick={() => setTab('lucro')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  tab === 'lucro'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Calendário de lucro
              </button>
            </div>

            {tab === 'geral' ? (
            <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Webhooks recebidos', value: data.summary.totalWebhooks, icon: Webhook, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Conversas WhatsApp', value: data.summary.waConversas, icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Vendas confirmadas', value: data.summary.totalSales, icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                {
                  label: 'Receita gerada',
                  value: `R$ ${data.summary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  icon: DollarSign,
                  color: 'text-purple-600',
                  bg: 'bg-purple-50 dark:bg-purple-900/20',
                },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
                  <div className={`${bg} p-2.5 rounded-xl flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Daily activity chart */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  Atividade diária (webhooks)
                </h2>
                {data.dailySeries.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-600 text-sm">Nenhum dado</div>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {data.dailySeries.slice(-30).map(({ date, count }) => (
                      <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="w-full bg-blue-500 dark:bg-blue-600 rounded-t-sm hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors cursor-default"
                          style={{ height: `${Math.max(4, (count / maxDaily) * 100)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                            {new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: {count}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600 mt-2">
                  <span>{data.dailySeries[0] ? new Date(data.dailySeries[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
                  <span>{data.dailySeries.slice(-1)[0] ? new Date(data.dailySeries.slice(-1)[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
                </div>
              </div>

              {/* By platform */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Por plataforma
                </h2>
                {Object.keys(data.byPlatform).length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-600 text-sm">Nenhum dado</div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(data.byPlatform)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([platform, stats]) => {
                        const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0
                        return (
                          <div key={platform}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {PLATFORM_LABELS[platform] || platform}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{stats.total} ({successRate}% ok)</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${PLATFORM_COLORS[platform] || 'bg-gray-400'}`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Top events table */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Top eventos recebidos
              </h2>
              {topEvents.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-600 text-sm text-center py-8">Nenhum evento registrado</p>
              ) : (
                <div className="space-y-2">
                  {topEvents.map(([event, count]) => (
                    <div key={event} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-mono w-64 truncate flex-shrink-0">{event}</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(count / maxEvent) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Calendário de lucro</h2>
                </div>
                {!data?.profitSeries || data.profitSeries.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-600 text-sm text-center py-8">
                    Esse calendário só aparece com leitura de dados reais.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {data.profitSeries.map(day => (
                      <div key={day.date} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-950">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-semibold text-gray-800 dark:text-white">
                            {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </div>
                          <div className={`text-xs font-bold ${day.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {day.roi != null ? `${day.roi.toFixed(1)}% ROI` : 'sem ROI'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-800">
                            <div className="text-gray-500">Receita</div>
                            <div className="font-bold text-green-500">R$ {day.revenue.toFixed(2)}</div>
                          </div>
                          <div className="rounded-xl bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-800">
                            <div className="text-gray-500">Custos</div>
                            <div className="font-bold text-orange-500">R$ {day.costs.toFixed(2)}</div>
                          </div>
                          <div className="rounded-xl bg-white dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-800 col-span-2">
                            <div className="text-gray-500">Lucro</div>
                            <div className={`font-black ${day.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              R$ {day.profit.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
