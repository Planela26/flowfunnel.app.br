'use client'

import { ReactNode } from 'react'
import { CheckCircle, Circle, ChevronRight } from 'lucide-react'

interface Step {
  id: number
  title: string
  short: string
}

interface Props {
  steps: Step[]
  currentStep: number
  accentColor: string
  children: ReactNode
}

export function TutorialLayout({ steps, currentStep, accentColor, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left sidebar — step tracker */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 sticky top-8">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Progresso
              </p>
              <ol className="space-y-1">
                {steps.map((step) => {
                  const done = currentStep > step.id
                  const active = currentStep === step.id
                  return (
                    <li key={step.id} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {done ? (
                          <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
                        ) : active ? (
                          <div className={`w-5 h-5 rounded-full border-2 ${accentColor} flex items-center justify-center`}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                          </div>
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                        )}
                      </div>
                      <div>
                        <p className={`text-xs leading-tight ${
                          active
                            ? 'font-bold text-gray-900 dark:text-white'
                            : done
                            ? 'font-medium text-green-700 dark:text-green-400'
                            : 'font-medium text-gray-400 dark:text-gray-500'
                        }`}>
                          {step.short}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                  <span>Concluído</span>
                  <span>{Math.round(((currentStep - 1) / (steps.length - 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}

interface NavProps {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  accentClass?: string
}

export function TutorialNav({
  onBack,
  onNext,
  nextLabel = 'Próximo',
  backLabel = 'Voltar',
  nextDisabled = false,
  loading = false,
  accentClass = 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
}: NavProps) {
  return (
    <div className="flex gap-3 pt-6 border-t dark:border-gray-700 mt-6">
      {onBack && (
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-40"
        >
          {backLabel}
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled || loading}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-lg text-white font-semibold transition disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed ${accentClass}`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Aguarde...
            </span>
          ) : (
            <>
              {nextLabel}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

interface TooltipProps {
  text: string
  children: ReactNode
}

export function Tooltip({ text, children }: TooltipProps) {
  return (
    <span className="relative group inline-flex items-center gap-1 cursor-help">
      {children}
      <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs flex items-center justify-center font-bold">?</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs font-bold rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  )
}

interface FieldProps {
  label: string
  tooltip?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export function FormField({ label, tooltip, hint, required, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
        {tooltip ? (
          <Tooltip text={tooltip}>{label}</Tooltip>
        ) : label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

interface InfoBoxProps {
  type?: 'info' | 'warning' | 'success' | 'tip'
  title?: string
  className?: string
  children: ReactNode
}

export function InfoBox({ type = 'info', title, className = '', children }: InfoBoxProps) {
  const styles = {
    info:    'bg-blue-50   dark:bg-blue-900/30   border-blue-200   dark:border-blue-700   text-blue-900   dark:text-blue-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200',
    success: 'bg-green-50  dark:bg-green-900/30  border-green-200  dark:border-green-700  text-green-900  dark:text-green-200',
    tip:     'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-200',
  }
  const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', tip: '💡' }

  return (
    <div className={`border rounded-lg p-4 ${styles[type]} ${className}`}>
      {title && (
        <p className="font-bold mb-1.5 text-sm">
          {icons[type]} {title}
        </p>
      )}
      <div className="text-sm font-bold">{children}</div>
    </div>
  )
}

interface CopyFieldProps {
  label: string
  value: string
  mono?: boolean
}

export function CopyField({ label, value, mono = true }: CopyFieldProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-gray-200 ${mono ? 'font-mono' : ''}`}
        />
        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition text-xs font-medium text-gray-600 dark:text-gray-300"
        >
          Copiar
        </button>
      </div>
    </div>
  )
}
