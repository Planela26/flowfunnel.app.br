'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle, UserPlus, AlertCircle } from 'lucide-react'

type State = 'form' | 'sent' | 'no_account'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [state, setState] = useState<State>('form')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao processar solicitação.')
      } else if (data.result === 'no_account') {
        setState('no_account')
      } else {
        setState('sent')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-full mb-4 shadow-2xl overflow-hidden ring-2 ring-white/20">
            <img src="/flowsara-logo.jpg" alt="FlowSara" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white">FlowSara</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* ── LINK ENVIADO ─────────────────────────────────────────────── */}
          {state === 'sent' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link enviado!</h2>
              <p className="text-gray-600 mb-2">
                Enviamos um link de redefinição para:
              </p>
              <p className="font-semibold text-blue-700 mb-4 break-all">{email}</p>
              <p className="text-sm text-gray-400 mb-6">
                Verifique também sua caixa de spam. O link expira em <strong>1 hora</strong>.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Link>
            </div>
          )}

          {/* ── EMAIL VÁLIDO, SEM CONTA ───────────────────────────────────── */}
          {state === 'no_account' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-9 h-9 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Nenhuma conta encontrada</h2>
              <p className="text-gray-600 mb-1">
                Não existe uma conta no FlowSara com o email:
              </p>
              <p className="font-semibold text-gray-800 mb-5 break-all">{email}</p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6 text-left">
                <p className="font-semibold mb-1">O que você pode fazer:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-600">
                  <li>Criar uma nova conta com esse email</li>
                  <li>Tentar outro email que você possa ter usado</li>
                </ul>
              </div>

              <button
                onClick={() => router.push(`/register?email=${encodeURIComponent(email)}`)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mb-3"
              >
                <UserPlus className="w-4 h-4" />
                Criar conta com esse email
              </button>

              <button
                onClick={() => { setState('form'); setEmail('') }}
                className="w-full py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-xl transition-colors text-sm"
              >
                Tentar outro email
              </button>

              <div className="mt-5">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </Link>
              </div>
            </div>
          )}

          {/* ── FORMULÁRIO ───────────────────────────────────────────────── */}
          {state === 'form' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Esqueceu a senha?</h2>
                <p className="text-gray-500 text-sm">
                  Digite seu email cadastrado e enviaremos um link para criar uma nova senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Verificando...
                    </span>
                  ) : 'Enviar link de redefinição'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
