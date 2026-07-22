import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import { useState } from 'react'

export interface Alert {
  id: string
  type: 'warning' | 'success' | 'info' | 'error'
  title: string
  message: string
  timestamp: Date
}

interface AlertSystemProps {
  alerts: Alert[]
  onDismiss: (id: string) => void
}

export default function AlertSystem({ alerts, onDismiss }: AlertSystemProps) {
  if (alerts.length === 0) return null

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'
      case 'success':
        return 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-900 dark:text-green-200'
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
    }
  }

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
      case 'error':
        return <AlertTriangle className="w-5 h-5" />
      case 'success':
        return <CheckCircle className="w-5 h-5" />
      case 'info':
        return <Info className="w-5 h-5" />
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border-2 rounded-lg shadow-lg p-4 ${getAlertStyles(alert.type)} animate-slide-in`}
        >
          <div className="flex items-start gap-3">
            {getIcon(alert.type)}
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-1">{alert.title}</h4>
              <p className="text-sm">{alert.message}</p>
              <p className="text-xs opacity-70 mt-2">
                {alert.timestamp.toLocaleTimeString('pt-BR')}
              </p>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              className="opacity-70 hover:opacity-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
