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

      {/* Mobile: coluna vertical com setas para baixo. Desktop: linha horizontal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-0">
        {stages.map((stage, index) => {
          const percentage = maxValue > 0 ? ((stage.value / maxValue) * 100).toFixed(1) : '0.0'
          const prevValue = index > 0 ? stages[index - 1].value : null
          const conversionRate =
            prevValue != null && prevValue > 0
              ? ((stage.value / prevValue) * 100).toFixed(1)
              : null

          return (
            <div key={index} className="flex flex-col sm:flex-row sm:items-center">
              {/* Card do estágio */}
              <div
                className="rounded-xl p-4 flex sm:flex-col items-center sm:text-center gap-3 sm:gap-0 w-full sm:w-[130px] transition-all hover:shadow-md"
                style={{
                  backgroundColor: stage.color + '18',
                  border: `2px solid ${stage.color}40`,
                }}
              >
                {stage.icon && (
                  <span className="text-2xl sm:text-3xl sm:mb-2 flex-shrink-0">{stage.icon}</span>
                )}
                <div className="flex-1 sm:flex-none flex sm:flex-col items-center sm:items-center gap-2 sm:gap-0">
                  <div
                    className="text-xl sm:text-2xl font-bold sm:mb-1"
                    style={{ color: stage.color }}
                  >
                    {stage.value.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight sm:mb-1.5">
                    {stage.name}
                  </div>
                </div>
                <div className="ml-auto sm:ml-0 flex flex-col items-end sm:items-center gap-1">
                  <div
                    className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: stage.color + '25', color: stage.color }}
                  >
                    {percentage}%
                  </div>
                  {conversionRate !== null && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      ↳ {conversionRate}% conv.
                    </div>
                  )}
                </div>
              </div>

              {/* Seta: ↓ no mobile, → no desktop */}
              {index < stages.length - 1 && (
                <div className="flex items-center justify-center py-1 sm:py-0 sm:px-1 flex-shrink-0">
                  {/* seta para baixo no mobile */}
                  <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-5-5l5 5 5-5"/>
                  </svg>
                  {/* seta para direita no desktop */}
                  <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 hidden sm:block" />
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
