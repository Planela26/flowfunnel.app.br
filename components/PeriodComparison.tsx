import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface PeriodComparisonProps {
  current: number
  previous: number
  label: string
  format?: 'number' | 'currency' | 'percentage'
}

export default function PeriodComparison({ 
  current, 
  previous, 
  label,
  format = 'number' 
}: PeriodComparisonProps) {
  const difference = current - previous
  const percentChange = previous > 0 ? ((difference / previous) * 100) : 0
  const isPositive = difference > 0
  const isNeutral = difference === 0

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      case 'percentage':
        return `${value.toFixed(1)}%`
      default:
        return value.toLocaleString('pt-BR')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatValue(current)}</p>
        </div>
        
        <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded ${
          isNeutral 
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            : isPositive 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {isNeutral ? (
            <Minus className="w-4 h-4" />
          ) : isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          {Math.abs(percentChange).toFixed(1)}%
        </div>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Período anterior: {formatValue(previous)}
      </div>
    </div>
  )
}
