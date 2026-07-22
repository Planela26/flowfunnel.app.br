'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, TrendingUp, Sparkles, ArrowRight, X } from 'lucide-react'

type Trigger = {
  id: string
  severity: 'info' | 'warning' | 'danger'
  title: string
  message: string
  cta: string
}

const STORAGE_KEY = 'upgrade_triggers_dismissed_v1'

export default function UpgradeTriggers() {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      if (raw) setDismissed(JSON.parse(raw))
    } catch {}
    fetch('/api/dashboard/upgrade-triggers')
      .then(r => (r.ok ? r.json() : { triggers: [] }))
      .then(d => setTriggers(d.triggers || []))
      .catch(() => {})
  }, [])

  const dismiss = (id: string) => {
    const next = Array.from(new Set([...dismissed, id]))
    setDismissed(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  const visible = triggers.filter(t => !dismissed.includes(t.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {visible.map(t => {
        const Icon = t.severity === 'danger' ? AlertTriangle : t.severity === 'warning' ? TrendingUp : Sparkles
        const colors =
          t.severity === 'danger'
            ? 'from-red-600 to-rose-600 border-red-700'
            : t.severity === 'warning'
              ? 'from-amber-500 to-orange-500 border-amber-600'
              : 'from-blue-600 to-indigo-600 border-blue-700'
        return (
          <div
            key={t.id}
            className={`relative rounded-xl bg-gradient-to-r ${colors} text-white shadow-lg border overflow-hidden`}
          >
            <div className="flex items-center gap-3 sm:gap-4 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm sm:text-base leading-tight">{t.title}</p>
                <p className="text-xs sm:text-sm text-white/90 mt-0.5">{t.message}</p>
              </div>
              <Link
                href="/billing"
                className="hidden sm:inline-flex items-center gap-1.5 bg-white text-gray-900 font-bold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg shadow hover:scale-105 transition flex-shrink-0"
              >
                {t.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => dismiss(t.id)}
                className="text-white/70 hover:text-white p-1 flex-shrink-0"
                aria-label="Dispensar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Link
              href="/billing"
              className="sm:hidden flex items-center justify-center gap-1.5 bg-white/95 text-gray-900 font-bold text-xs px-3 py-2 mx-3 mb-3 rounded-lg shadow"
            >
              {t.cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )
      })}
    </div>
  )
}
