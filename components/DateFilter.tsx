import { Calendar, Filter } from 'lucide-react'

interface DateFilterProps {
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
  customDateRange?: { start: string; end: string };
  onCustomDateChange?: (start: string, end: string) => void;
  startDate?: Date | null;
  endDate?: Date | null;
  period?: string;
  onFilterChange?: (start: any, end: any, period: any) => void;
}

export default function DateFilter({ 
  selectedPeriod, 
  onPeriodChange,
  customDateRange,
  onCustomDateChange 
}: DateFilterProps) {
  const periods = [
    { value: 'today', label: 'Hoje' },
    { value: '7days', label: 'Últimos 7 dias' },
    { value: '30days', label: 'Últimos 30 dias' },
    { value: 'custom', label: 'Personalizado' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="font-semibold dark:text-white">Período</h3>
      </div>
      
      <div className="flex gap-2 flex-wrap">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => onPeriodChange && onPeriodChange(period.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedPeriod === period.value
                ? 'bg-whatsapp-light dark:bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {selectedPeriod === 'custom' && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Data Inicial</label>
            <input
              type="date"
              value={customDateRange?.start || ''}
              onChange={(e) => onCustomDateChange?.(e.target.value, customDateRange?.end || '')}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Data Final</label>
            <input
              type="date"
              value={customDateRange?.end || ''}
              onChange={(e) => onCustomDateChange?.(customDateRange?.start || '', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
