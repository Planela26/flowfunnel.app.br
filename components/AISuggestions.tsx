'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Lightbulb, Sparkles, AlertTriangle, Info, CheckCircle, RefreshCw, Clock } from 'lucide-react'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const METRICS_DEBOUNCE_MS = 800 // wait 800ms after metrics change before fetching

interface Suggestion {
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

interface AISuggestionsProps {
  metrics: {
    whatsapp?: any
    facebook?: any
    hotmart?: any
  }
}

export default function AISuggestions({ metrics }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'ai' | 'demo' | 'basic' | 'not_configured' | 'error'>('basic')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs for stable access without triggering re-renders
  const isFetchingRef = useRef(false)
  const metricsRef = useRef(metrics)
  const lastMetricsKeyRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep metricsRef in sync with the latest prop on every render
  metricsRef.current = metrics

  // Check if any integration is actually connected with real data
  const hasAnyData = (m: typeof metrics) => {
    const hasData = (x: any) => !!x && (x.connected === true || (typeof x === 'object' && Object.keys(x).length > 0))
    return hasData(m.whatsapp) || hasData(m.facebook) || hasData(m.hotmart)
  }

  // Core fetch function — stable reference, reads metrics from ref
  const performFetch = useCallback(async (force: boolean = false) => {
    // Prevent overlapping concurrent requests
    if (isFetchingRef.current) return

    const snapshot = metricsRef.current

    // If no integration has any data, skip the API call entirely
    if (!hasAnyData(snapshot)) {
      setSuggestions([])
      setMode('basic')
      setLoading(false)
      return
    }

    const key = JSON.stringify(snapshot)

    // Skip if metrics haven't changed and this isn't a scheduled/manual refresh
    if (!force && key === lastMetricsKeyRef.current && lastMetricsKeyRef.current !== '') return

    lastMetricsKeyRef.current = key
    isFetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: snapshot }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
        setMode(data.mode || 'basic')
        setLastUpdated(new Date())
      } else {
        setMode('error')
        setError('O servidor retornou um erro. Tente novamente.')
      }
    } catch (err) {
      console.error('Erro ao buscar sugestões de IA:', err)
      setMode('error')
      setError('Falha na conexão. Verifique sua rede e tente novamente.')
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, []) // stable — all dynamic values accessed via refs

  // Mount: initial fetch + 15-minute auto-refresh interval
  useEffect(() => {
    performFetch()

    intervalRef.current = setInterval(() => {
      performFetch(true) // force refresh on every scheduled tick
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [performFetch]) // performFetch is stable so this runs once

  // Re-fetch when metrics prop changes (debounced to avoid rapid-fire calls)
  useEffect(() => {
    const key = JSON.stringify(metrics)
    if (key === lastMetricsKeyRef.current) return // nothing changed

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      performFetch()
    }, METRICS_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [metrics, performFetch])

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error':   return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-green-500'
      case 'warning': return 'border-l-yellow-500'
      case 'error':   return 'border-l-red-500'
      default:        return 'border-l-blue-500'
    }
  }

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high:   'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low:    'bg-blue-100 text-blue-700',
    }
    const labels: Record<string, string> = {
      high:   'Alta',
      medium: 'Média',
      low:    'Baixa',
    }
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${colors[priority] ?? 'bg-gray-100 text-gray-600'}`}>
        {labels[priority] ?? priority}
      </span>
    )
  }

  const getModeLabel = () => {
    switch (mode) {
      case 'ai':             return '✨ Powered by GPT-4'
      case 'not_configured': return '⚙️ OpenAI não configurada'
      case 'error':          return '⚠️ Serviço indisponível'
      case 'demo':           return '🎯 Modo Demo'
      default:               return '📊 Análise Básica'
    }
  }

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-gray-900 dark:bg-gray-700 p-2 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sugestões da IA</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{getModeLabel()}</p>
          </div>
        </div>

        {hasAnyData(metrics) && (
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Clock className="w-3 h-3" />
                <span>Atualizado às {formatLastUpdated(lastUpdated)}</span>
              </div>
            )}
            <button
              onClick={() => performFetch(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition disabled:opacity-50 text-gray-700 dark:text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        )}
      </div>

      {/* Next refresh info */}
      {mode === 'ai' && lastUpdated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Próxima atualização automática em 15 minutos
        </p>
      )}

      {/* Suggestion list */}
      <div className="space-y-3">
        {loading && suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Analisando suas métricas...</p>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Erro ao carregar sugestões</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{error}</p>
            </div>
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm transition"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{getIcon(suggestion.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{suggestion.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{suggestion.description}</p>
                </div>
              </div>
            </div>
          ))
        ) : !hasAnyData(metrics) ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nenhum dado disponível</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
              A análise aparece quando existe qualquer card com dados, inclusive demo ou fictícios.
            </p>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium">Nenhuma sugestão disponível</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tente atualizar ou aguarde novos dados chegarem.
            </p>
          </div>
        )}
      </div>

      {/* Loading overlay for refreshes (when suggestions already exist) */}
      {loading && suggestions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Atualizando análise...
        </div>
      )}

      {/* Configuration notice */}
      {(mode === 'demo' || mode === 'not_configured') && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 <strong>Para ativar análise por ChatGPT-4:</strong> adicione a variável{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">OPENAI_API_KEY</code>{' '}
            nos segredos do projeto. O ChatGPT-4 analisará suas métricas reais de WhatsApp, Facebook e Hotmart em tempo real.
          </p>
        </div>
      )}
    </div>
  )
}
