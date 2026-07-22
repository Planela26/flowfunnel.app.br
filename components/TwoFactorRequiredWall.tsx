'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ShieldAlert } from 'lucide-react'

// Bloqueia o app para contas ADMIN/OWNER que ainda não ativaram o 2FA. Como o
// 2FA é obrigatório para esses papéis, exibimos um overlay que só some quando o
// usuário ativa o segundo fator (ou já está na própria página de segurança).
export default function TwoFactorRequiredWall() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  const role = (session?.user?.role || '').toUpperCase()
  const isPrivileged = role === 'ADMIN' || role === 'OWNER'

  useEffect(() => {
    if (status !== 'authenticated' || !isPrivileged) return
    let active = true
    fetch('/api/account/2fa/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setEnabled(Boolean(data.enabled))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [status, isPrivileged, pathname])

  if (status !== 'authenticated' || !isPrivileged) return null
  // Confia na sessão se já indicar 2FA ativo (evita flash do overlay).
  if (session?.user?.twoFactorEnabled) return null
  if (enabled === null || enabled === true) return null
  // Não bloqueia a própria página onde o usuário ativa o 2FA.
  if (pathname === '/settings/security') return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          Ative a verificação em duas etapas
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Sua conta tem permissões administrativas. Por segurança, é{' '}
          <strong className="text-gray-700 dark:text-gray-300">obrigatório</strong>{' '}
          ativar a autenticação de dois fatores (2FA) antes de continuar.
        </p>

        <button
          onClick={() => router.push('/settings/security')}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4" />
          Ativar 2FA agora
        </button>
      </div>
    </div>
  )
}
