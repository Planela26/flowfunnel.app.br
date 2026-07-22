'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Lightbulb, AlertTriangle, TrendingUp, Sparkles, Loader2 } from 'lucide-react'

const CARD_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  facebook: { name: 'Facebook Ads', icon: 'f', color: 'text-blue-600' },
  google: { name: 'Google Ads', icon: 'G', color: 'text-yellow-600' },
  tiktok: { name: 'TikTok Ads', icon: '🎵', color: 'text-pink-600' },
  whatsapp: { name: 'WhatsApp', icon: '💬', color: 'text-green-600' },
  hotmart: { name: 'Hotmart', icon: '🔥', color: 'text-orange-600' },
  kiwify: { name: 'Kiwify', icon: '🌿', color: 'text-emerald-600' },
}

interface InsightData {
  resumo: string
  atencao: string
  dicas: string[]
  estimativa: string
}

interface CardInsightModalProps {
  cardType: string | null
  cardData: any
  onClose: () => void
}

function hasMeaningfulData(cardType: string | null, data: any): boolean {
  if (!cardType || !data) return false
  if (data.connected === false) return false
  if (data.connected === true) return true
  const raw = data.raw ?? data
  return raw && typeof raw === 'object' && Object.keys(raw).length > 0
}

export default function CardInsightModal({ cardType, cardData, onClose }: CardInsightModalProps) {
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  const COOLDOWN_MS = 90 * 60 * 1000
  const cooldownRemaining = lastGeneratedAt ? Math.max(0, COOLDOWN_MS - (nowTick - lastGeneratedAt)) : 0
  const cooldownMinutes = Math.ceil(cooldownRemaining / 60000)
  const dataReady = hasMeaningfulData(cardType, cardData)

  const fetchInsight = useCallback(async () => {
    if (!cardType || fetched || loading || !dataReady) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/card-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType, data: cardData }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar análise')
      setInsight(data)
      setFetched(true)
      setLastGeneratedAt(Date.now())
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar análise')
    } finally {
      setLoading(false)
    }
  }, [cardType, cardData, fetched, loading])

  useEffect(() => {
    setInsight(null)
    setError('')
    setFetched(false)
    setLastGeneratedAt(null)
  }, [cardType])

  useEffect(() => {
    if (cardType && !fetched && !loading && dataReady) fetchInsight()
  }, [cardType, fetched, loading, dataReady, fetchInsight])

  useEffect(() => {
    if (!lastGeneratedAt || cooldownRemaining <= 0) return
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [lastGeneratedAt, cooldownRemaining])

  if (!cardType) return null

  const meta = CARD_LABELS[cardType] || { name: cardType, icon: '📊', color: 'text-gray-600' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Sparkles className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400 w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-none mb-0.5">Análise por ChatGPT-4</p>
              <h2 className={`text-sm font-bold ${meta.color}`}>{meta.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {!dataReady && !loading && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center">
              <AlertTriangle className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
                Sem dados para analisar
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Conecte essa integração no Dashboard para que o ChatGPT-4 analise os dados disponíveis.
                Se existir qualquer card com dados, reais ou de demonstração, a análise aparece.
              </p>
            </div>
          )}

          {dataReady && loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Analisando seus dados com ChatGPT-4...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {insight && !loading && (
            <>
              {/* Resumo */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  📋 Análise Geral
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {insight.resumo}
                </p>
              </div>

              {/* Ponto de atenção */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    Ponto de Atenção
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {insight.atencao}
                  </p>
                </div>
              </div>

              {/* Dicas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-gray-500" />
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Ações Recomendadas
                  </p>
                </div>
                <ul className="space-y-2.5">
                  {insight.dicas.map((dica, i) => (
                    <li key={i} className="flex gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-700 text-white text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{dica}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Estimativa */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-3">
                <TrendingUp className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    Estimativa de Impacto
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {insight.estimativa}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <p className="text-[10px] text-gray-400">Gerado por ChatGPT-4 · Resultados podem variar</p>
          <button
            onClick={() => {
              if (cooldownRemaining > 0 || !dataReady) return
              setFetched(false)
              fetchInsight()
            }}
            disabled={loading || cooldownRemaining > 0 || !dataReady}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {!dataReady
              ? 'Conecte para analisar'
              : cooldownRemaining > 0
                ? `Faça uma nova análise daqui a ${cooldownMinutes} min`
                : 'Regenerar análise'}
          </button>
        </div>
      </div>
    </div>
  )
}
