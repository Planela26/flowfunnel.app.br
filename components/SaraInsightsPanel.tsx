'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'

type Insight = {
  id: string
  type: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical' | string
  isRead: boolean
  createdAt: string
}

type Summary = {
  unread: number
  critical: number
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    label: 'Atenção urgente',
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
    iconClassName: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Recomendação',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    iconClassName: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300',
  },
  info: {
    icon: Info,
    label: 'Insight',
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
    iconClassName: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300',
  },
} as const

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function SaraInsightsPanel({ compact = false }: { compact?: boolean }) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [summary, setSummary] = useState<Summary>({ unread: 0, critical: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const response = await fetch('/api/sara/insights?unread=true&limit=5', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('insights request failed')
      const data = await response.json()
      setInsights(Array.isArray(data.insights) ? data.insights : [])
      setSummary(data.summary ?? { unread: 0, critical: 0 })
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  async function markRead(id: string) {
    setInsights(current => current.filter(insight => insight.id !== id))
    setSummary(current => ({ ...current, unread: Math.max(0, current.unread - 1) }))
    await fetch('/api/sara/insights', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightId: id }),
    }).catch(() => {})
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 h-5 w-44 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/60" />
          <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/60" />
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Insights da Sara.AI</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {summary.unread > 0 ? `${summary.unread} pendente${summary.unread === 1 ? '' : 's'}` : 'Tudo em dia'}
              {summary.critical > 0 ? ` · ${summary.critical} urgente${summary.critical === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          title="Atualizar insights"
          aria-label="Atualizar insights"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          Não foi possível carregar os insights agora.
        </div>
      ) : insights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center dark:border-gray-700">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nenhum alerta pendente</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">A Sara está monitorando sua operação.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map(insight => {
            const config = severityConfig[insight.severity as keyof typeof severityConfig] ?? severityConfig.info
            const Icon = config.icon
            return (
              <article key={insight.id} className={`flex gap-3 rounded-xl border p-3 ${config.className}`}>
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.iconClassName}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">{config.label}</span>
                      <h3 className="text-sm font-semibold">{insight.title}</h3>
                    </div>
                    <button
                      onClick={() => void markRead(insight.id)}
                      className="shrink-0 rounded-md p-1 opacity-60 transition hover:bg-black/10 hover:opacity-100"
                      title="Marcar como lido"
                      aria-label={`Marcar ${insight.title} como lido`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {!compact && <p className="mt-1 text-xs leading-relaxed opacity-90">{insight.description}</p>}
                  <p className="mt-1 text-[10px] opacity-60">{formatDate(insight.createdAt)}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!compact && (
        <Link href="/admin/sara-ai" className="mt-4 inline-block text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
          Ver inteligência da Sara.AI →
        </Link>
      )}
    </section>
  )
}