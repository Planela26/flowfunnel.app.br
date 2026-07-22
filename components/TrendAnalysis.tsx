'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'

type Direction = 'rising' | 'stable' | 'falling'
type KpiKey = 'vendas' | 'faturamento' | 'leads' | 'conversao' | 'gasto'
type Granularity = 'week' | 'month'

interface Trend {
  direction: Direction
  pctChangeRecent: number
  pctChangeWindow: number
  current: number
  previous: number
}

interface TrendAlert {
  kpi: KpiKey
  severity: 'warning' | 'critical'
  message: string
  streak: number
}

interface SeriesPoint {
  key: string
  start: string
  inProgress: boolean
  vendas: number
  faturamento: number
  leads: number
  conversao: number
  gasto: number
}

interface TrendData {
  granularity: Granularity
  periods: number
  windowStart: string
  windowEnd: string
  funnelCount?: number
  series: SeriesPoint[]
  inProgress: SeriesPoint
  trends: Record<KpiKey, Trend>
  alerts: TrendAlert[]
}

const KPI_META: Record<KpiKey, { label: string; format: 'number' | 'currency' | 'percentage' }> = {
  vendas: { label: 'Vendas', format: 'number' },
  faturamento: { label: 'Faturamento', format: 'currency' },
  leads: { label: 'Leads', format: 'number' },
  conversao: { label: 'Conversão', format: 'percentage' },
  gasto: { label: 'Gasto', format: 'currency' },
}

function formatValue(v: number, format: 'number' | 'currency' | 'percentage') {
  if (format === 'currency')
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (format === 'percentage') return `${v.toFixed(1)}%`
  return v.toLocaleString('pt-BR')
}

function directionStyle(d: Direction) {
  switch (d) {
    case 'rising':
      return {
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        Icon: TrendingUp,
        label: 'Subindo',
      }
    case 'falling':
      return {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        Icon: TrendingDown,
        label: 'Caindo',
      }
    default:
      return {
        color: 'text-gray-700 dark:text-gray-300',
        bg: 'bg-gray-100 dark:bg-gray-700',
        Icon: Minus,
        label: 'Estável',
      }
  }
}

export default function TrendAnalysis() {
  const [data, setData] = useState<TrendData | null>(null)
  const [granularity, setGranularity] = useState<Granularity>('week')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const periods = granularity === 'week' ? 8 : 6
    fetch(`/api/analytics/trends?granularity=${granularity}&periods=${periods}`)
      .then(async r => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json() as Promise<TrendData>
      })
      .then(d => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar a análise de tendências.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [granularity])

  const windowLabel =
    data && (data.granularity === 'week' ? `${data.periods} semanas` : `${data.periods} meses`)
  const recentLabel = granularity === 'week' ? 'semana' : 'mês'
  const inProgressLabel = granularity === 'week' ? 'Semana atual' : 'Mês atual'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Análise de tendências
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {windowLabel
              ? `Janela analisada: ${windowLabel} completos (período em curso fica fora da comparação).`
              : 'Tendência por KPI ao longo do tempo.'}
          </p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setGranularity('week')}
            className={`px-3 py-1 rounded font-semibold transition ${
              granularity === 'week'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Semanal
          </button>
          <button
            type="button"
            onClick={() => setGranularity('month')}
            className={`px-3 py-1 rounded font-semibold transition ${
              granularity === 'month'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Mensal
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
          Carregando análise de tendências...
        </div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-600 dark:text-red-400 py-4">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {data.alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {data.alerts.map((a, i) => (
                <div
                  key={`${a.kpi}-${i}`}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    a.severity === 'critical'
                      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                      : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong className="font-bold">Alerta de tendência:</strong> {a.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(KPI_META) as KpiKey[]).map(key => {
              const trend = data.trends[key]
              const meta = KPI_META[key]
              const ds = directionStyle(trend.direction)
              const Icon = ds.Icon
              const recentSign = trend.pctChangeRecent >= 0 ? '+' : ''
              const windowSign = trend.pctChangeWindow >= 0 ? '+' : ''
              const inProgressValue = data.inProgress?.[key] ?? 0
              return (
                <div
                  key={key}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{meta.label}</p>
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${ds.bg} ${ds.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {ds.label}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatValue(trend.current, meta.format)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Último {recentLabel} completo · {recentSign}
                    {trend.pctChangeRecent.toFixed(1)}% vs. {recentLabel} anterior
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Janela: {windowSign}
                    {trend.pctChangeWindow.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                    {inProgressLabel}: {formatValue(inProgressValue as number, meta.format)}{' '}
                    <span className="text-gray-400 dark:text-gray-500">(em curso)</span>
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
