'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, X, Settings, Check } from 'lucide-react'

const STORAGE_KEY = 'ff_cookie_consent_v1'

type Prefs = {
  necessary: true
  analytics: boolean
  marketing: boolean
  acceptedAt: string
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        const t = setTimeout(() => setVisible(true), 600)
        return () => clearTimeout(t)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const persist = (prefs: Prefs) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {}
    setVisible(false)
    setShowSettings(false)
  }

  const acceptAll = () =>
    persist({ necessary: true, analytics: true, marketing: true, acceptedAt: new Date().toISOString() })

  const rejectAll = () =>
    persist({ necessary: true, analytics: false, marketing: false, acceptedAt: new Date().toISOString() })

  const saveCustom = () =>
    persist({ necessary: true, analytics, marketing, acceptedAt: new Date().toISOString() })

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-5 pointer-events-none">
      <div className="mx-auto max-w-3xl pointer-events-auto rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-[slideUp_0.4s_ease]">
        {!showSettings ? (
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Usamos cookies
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  Usamos cookies essenciais para o funcionamento do site e, com seu consentimento, cookies de análise e marketing para melhorar sua experiência. Leia nossa{' '}
                  <Link href="/privacidade" className="text-blue-600 dark:text-blue-400 underline font-medium">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </div>
              <button
                onClick={rejectAll}
                aria-label="Fechar"
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <Settings className="w-4 h-4" />
                Personalizar
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                Apenas essenciais
              </button>
              <button
                onClick={acceptAll}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md"
              >
                Aceitar tudo
              </button>
            </div>
            <div className="mt-3 sm:hidden">
              <button
                onClick={rejectAll}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition"
              >
                Fechar e continuar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Preferências de cookies
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Voltar"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <PrefRow
                title="Essenciais"
                desc="Necessários para login, sessão e funcionamento básico do site. Não podem ser desativados."
                checked
                disabled
                onChange={() => {}}
              />
              <PrefRow
                title="Análise"
                desc="Nos ajudam a entender o uso do produto para melhorar a experiência (ex.: páginas mais visitadas)."
                checked={analytics}
                onChange={setAnalytics}
              />
              <PrefRow
                title="Marketing"
                desc="Usados para personalizar comunicação e medir performance de campanhas."
                checked={marketing}
                onChange={setMarketing}
              />
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                onClick={rejectAll}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                Recusar opcionais
              </button>
              <button
                onClick={saveCustom}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md inline-flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Salvar preferências
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function PrefRow({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string
  desc: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 ${
        disabled ? 'bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {title}
          {disabled && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              Sempre ativo
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
          {desc}
        </div>
      </div>
    </label>
  )
}
