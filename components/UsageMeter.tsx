'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, AlertTriangle, CheckCircle, TrendingUp, RotateCcw } from 'lucide-react'

interface UsageData {
  plan: string
  used: number
  limit: number
  unlimited: boolean
  percent: number
  remaining: number
  isNearLimit: boolean
  isOverLimit: boolean
  resetDate: string
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Grátis', START: 'START', PRO: 'PRO', SCALE: 'SCALE',
}

export default function UsageMeter() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    )
  }

  if (!data) return null

  const { plan, used, limit, unlimited, percent, remaining, isNearLimit, isOverLimit, resetDate } = data

  const barColor = isOverLimit
    ? 'bg-red-500'
    : isNearLimit
    ? 'bg-amber-500'
    : percent >= 50
    ? 'bg-blue-600'
    : 'bg-blue-500'

  const resetDateStr = new Date(resetDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

  const borderClass = isOverLimit
    ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-900/10'
    : isNearLimit
    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10'
    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isOverLimit ? (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          ) : isNearLimit ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : unlimited ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ) : (
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Conversas — Plano{' '}
            <span className={
              isOverLimit ? 'text-red-600 dark:text-red-400'
              : isNearLimit ? 'text-amber-600 dark:text-amber-400'
              : 'text-blue-600 dark:text-blue-400'
            }>
              {PLAN_LABELS[plan] || plan}
            </span>
          </span>
        </div>
        <Link
          href="/billing"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
        >
          <TrendingUp className="w-3 h-3" />
          {isOverLimit || isNearLimit ? 'Fazer upgrade' : 'Gerenciar plano'}
        </Link>
      </div>

      {unlimited ? (
        <div className="flex items-center gap-3">
          <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex-1 overflow-hidden">
            <div className="h-full w-full rounded-full bg-emerald-400 opacity-60" />
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
            ∞ Ilimitado
          </span>
        </div>
      ) : (
        <>
          <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 mb-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`text-xs font-medium ${
              isOverLimit ? 'text-red-600 dark:text-red-400'
              : isNearLimit ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-500 dark:text-gray-400'
            }`}>
              {isOverLimit
                ? `⛔ Limite atingido — ${used.toLocaleString('pt-BR')} / ${limit.toLocaleString('pt-BR')}`
                : isNearLimit
                ? `⚠️ Restam apenas ${remaining.toLocaleString('pt-BR')} conversas`
                : `${used.toLocaleString('pt-BR')} / ${limit.toLocaleString('pt-BR')} conversas`}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Renova {resetDateStr}
            </span>
          </div>

          {(isOverLimit || isNearLimit) && (
            <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
              isOverLimit
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
            }`}>
              <span>
                {isOverLimit
                  ? 'Funil bloqueado — faça upgrade para continuar recebendo conversas.'
                  : 'Você está próximo do limite. Faça upgrade para não perder conversas.'}
              </span>
              <Link
                href="/billing"
                className="font-bold whitespace-nowrap hover:underline"
              >
                Ver planos →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
