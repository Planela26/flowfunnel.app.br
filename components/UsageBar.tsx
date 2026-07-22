'use client'

import Link from 'next/link'
import { Zap, AlertTriangle } from 'lucide-react'
import { useCachedJSON } from '@/lib/clientCache'

interface Usage {
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

export default function UsageBar() {
  const { data: usage } = useCachedJSON<Usage>('/api/usage', { refreshIntervalMs: 300000 })

  if (!usage || usage.unlimited) return null

  const barColor = usage.isOverLimit
    ? 'bg-red-500'
    : usage.isNearLimit
    ? 'bg-yellow-400'
    : 'bg-blue-500'

  const resetDate = new Date(usage.resetDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          {usage.isNearLimit || usage.isOverLimit
            ? <AlertTriangle className="w-3 h-3 text-yellow-500" />
            : <Zap className="w-3 h-3 text-blue-400" />
          }
          Conversas
        </span>
        <span className={`text-xs font-semibold ${
          usage.isOverLimit ? 'text-red-600' : usage.isNearLimit ? 'text-yellow-600' : 'text-gray-600 dark:text-gray-300'
        }`}>
          {usage.used.toLocaleString('pt-BR')} / {usage.limit.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${usage.percent}%` }}
        />
      </div>
      {usage.isOverLimit ? (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-red-600 font-medium">Limite atingido</span>
          <Link href="/checkout?plan=PRO" className="text-xs text-blue-600 hover:underline font-medium">Fazer upgrade →</Link>
        </div>
      ) : usage.isNearLimit ? (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-yellow-600">{usage.remaining} restantes</span>
          <Link href="/checkout?plan=PRO" className="text-xs text-blue-600 hover:underline font-medium">Upgrade →</Link>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Renova em {resetDate}</p>
      )}
    </div>
  )
}
