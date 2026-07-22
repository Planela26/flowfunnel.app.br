'use client'

import Link from 'next/link'
import { TrendingDown, Pause, ArrowRight, Zap } from 'lucide-react'

type Suggestion = {
  type: 'pause' | 'invest' | 'fix'
  title: string
  description: string
}

interface Props {
  unlocked: boolean
  /** dados reais do dashboard (passados pelo pai) */
  data?: {
    spend?: number
    clicks?: number
    leads?: number
    sales?: number
    cpc?: string | number
    roi?: string | number
  }
}

export default function WastedTrafficCard({ unlocked, data }: Props) {
  const spend = Number(data?.spend ?? 0)
  const clicks = Number(data?.clicks ?? 0)
  const leads = Number(data?.leads ?? 0)
  const sales = Number(data?.sales ?? 0)

  // Estimativa de desperdício: tráfego sem conversão pesado em CPC médio
  const wastedClicks = clicks > 0 ? Math.max(0, clicks - leads * 3) : 0
  const wastedShare = clicks > 0 ? wastedClicks / clicks : 0
  const wastedMoney = spend * wastedShare

  const suggestions: Suggestion[] = []

  if (wastedShare > 0.5 && spend > 0) {
    suggestions.push({
      type: 'pause',
      title: 'Pause as campanhas com CPC acima da média',
      description: `Aproximadamente ${(wastedShare * 100).toFixed(0)}% do seu tráfego não está convertendo.`,
    })
  }

  if (sales > 0 && roi(spend, sales) > 1.5) {
    suggestions.push({
      type: 'invest',
      title: 'Invista mais nas campanhas de melhor ROI',
      description: 'Suas vendas estão dando retorno positivo — escalar pode multiplicar o resultado.',
    })
  }

  if (leads > 0 && sales / Math.max(leads, 1) < 0.1) {
    suggestions.push({
      type: 'fix',
      title: 'Corrija o gargalo de conversão',
      description: 'Muitos leads chegam, mas poucos viram cliente. Revise o pitch ou a oferta.',
    })
  }

  const hasRealData = unlocked && (spend > 0 || clicks > 0 || leads > 0 || sales > 0)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
            Desperdício de Tráfego
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
            PRO
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-100 dark:border-gray-700">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <div className="text-[10px] text-red-700 dark:text-red-300 font-semibold uppercase mb-1">
            Estimativa de Desperdício
          </div>
          <div className="text-2xl font-extrabold text-red-700 dark:text-red-400">
            R$ {wastedMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-red-700/80 dark:text-red-300/80 mt-1">
            últimos 30 dias
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold uppercase mb-1">
            Cliques sem conversão
          </div>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">
            {wastedClicks.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] text-blue-700/80 dark:text-blue-300/80 mt-1">
            de {clicks.toLocaleString('pt-BR')} totais
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
          Sugestões inteligentes
        </div>
        {hasRealData && suggestions.length > 0 ? (
          suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  s.type === 'pause'
                    ? 'bg-red-100 dark:bg-red-900/40'
                    : s.type === 'invest'
                      ? 'bg-green-100 dark:bg-green-900/40'
                      : 'bg-amber-100 dark:bg-amber-900/40'
                }`}
              >
                {s.type === 'pause' && <Pause className="w-3.5 h-3.5 text-red-700 dark:text-red-300" />}
                {s.type === 'invest' && <Zap className="w-3.5 h-3.5 text-green-700 dark:text-green-300" />}
                {s.type === 'fix' && <ArrowRight className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{s.description}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {hasRealData
                ? 'Nenhum desperdício significativo detectado nos últimos 30 dias.'
                : 'Conecte uma integração de tráfego (Facebook Ads, Google Ads ou TikTok Ads) para ver sugestões reais baseadas nos seus dados.'}
            </p>
          </div>
        )}
      </div>

      {unlocked && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          <Link
            href="/analytics"
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
          >
            Ver análise completa
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}

function roi(spend: number, sales: number): number {
  if (!spend) return 0
  return sales / spend
}
