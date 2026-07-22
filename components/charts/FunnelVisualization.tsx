'use client'

import { ArrowRight } from 'lucide-react'

interface FunnelStage {
  name: string
  value: number
  color: string
  icon?: string
}

interface FunnelVisualizationProps {
  title: string
  stages: FunnelStage[]
}

export default function FunnelVisualization({ title, stages = [] }: FunnelVisualizationProps) {
  const maxValue = (stages && stages[0]?.value) || 1

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">{title}</h3>

      {/* Cards lado a lado com setas entre eles */}
      <div className="flex items-center justify-center overflow-x-auto pb-2">
        {stages.map((stage, index) => {
          const percentage = maxValue > 0 ? ((stage.value / maxValue) * 100).toFixed(1) : '0.0'
          const prevValue = index > 0 ? stages[index - 1].value : null
          const conversionRate =
            prevValue != null && prevValue > 0
              ? ((stage.value / prevValue) * 100).toFixed(1)
              : null

          return (
            <div key={index} className="flex items-center flex-shrink-0">
              {/* Card do estágio */}
              <div
                className="rounded-xl p-4 flex flex-col items-center text-center w-[130px] transition-all hover:shadow-md"
                style={{
                  backgroundColor: stage.color + '18',
                  border: `2px solid ${stage.color}40`,
                }}
              >
                {stage.icon && (
                  <span className="text-3xl mb-2">{stage.icon}</span>
                )}
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: stage.color }}
                >
                  {stage.value.toLocaleString('pt-BR')}
                </div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight mb-1.5">
                  {stage.name}
                </div>
                <div
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: stage.color + '25', color: stage.color }}
                >
                  {percentage}%
                </div>
                {conversionRate !== null && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    ↳ {conversionRate}% conv.
                  </div>
                )}
              </div>

              {/* Seta entre cards */}
              {index < stages.length - 1 && (
                <div className="px-1 flex-shrink-0">
                  <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Resumo */}
      {stages.length >= 2 && stages[0].value > 0 ? (
        <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Taxa Geral</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {((stages[stages.length - 1].value / stages[0].value) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Drop-off Total</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {(stages[0].value - stages[stages.length - 1].value).toLocaleString('pt-BR')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Convertidos</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {stages[stages.length - 1].value.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum dado de funil disponível
        </div>
      )}
    </div>
  )
}
