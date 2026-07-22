'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Mail, X, Loader2 } from 'lucide-react'

export default function EmailVerificationBanner() {
  const { data: session, status } = useSession()
  const [dismissed, setDismissed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resentMsg, setResentMsg] = useState<string | null>(null)

  const show = status === 'authenticated' && !session?.user?.emailVerified

  if (!show || dismissed) return null

  const resend = async () => {
    setResending(true)
    setResentMsg(null)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResentMsg('Email reenviado! Verifique sua caixa de entrada.')
    } catch (err: any) {
      setResentMsg(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <Mail className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Confirme seu email</strong> para liberar todos os recursos.
            {resentMsg && <span className="ml-2 text-amber-700 dark:text-amber-400">{resentMsg}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
          >
            {resending && <Loader2 className="w-3 h-3 animate-spin" />}
            Reenviar email
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
