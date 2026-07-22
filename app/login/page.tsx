'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authPatternUrl, authPatternSize } from '@/lib/authPattern'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFullscreenLoader, setShowFullscreenLoader] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [totp, setTotp] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)

  // Mensagem quando o login Google é bloqueado por 2FA (use email + senha).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === '2fa_use_password') {
      setError('Sua conta tem verificação em duas etapas ativa. Entre com email e senha para usar o código 2FA.')
    }
  }, [])

  // Após o spinner do botão, transiciona para o overlay fullscreen com logo girando
  useEffect(() => {
    if (!loading) {
      setShowFullscreenLoader(false)
      return
    }
    const t = setTimeout(() => setShowFullscreenLoader(true), 250)
    return () => clearTimeout(t)
  }, [loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        totp: twoFactorRequired ? totp : undefined,
        redirect: false,
      })
      if (result?.error) {
        // Senha correta, mas a conta exige segundo fator: avança pra etapa 2.
        if (result.error === '2FA_REQUIRED') {
          setTwoFactorRequired(true)
          setError('')
          setLoading(false)
          return
        }
        if (twoFactorRequired) {
          setError(useRecovery ? 'Código de recuperação inválido' : 'Código de verificação inválido')
        } else {
          setError('Email ou senha incorretos')
        }
        setLoading(false)
        return
      }
      // Hard navigation: invalida todo o cache de prefetch do client
      // (evita bounce-back caso o middleware tenha cacheado redirect anterior)
      window.location.assign('/dashboard')
    } catch {
      setError('Erro ao fazer login')
      setLoading(false)
    }
  }

  const resetToFirstStep = () => {
    setTwoFactorRequired(false)
    setTotp('')
    setUseRecovery(false)
    setError('')
  }

  const handleGoogleLogin = () => {
    setLoading(true)
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4 overflow-hidden">

      {/* Animated WhatsApp-like pattern */}
      <style>{`
        @keyframes diagonalScroll {
          from { background-position: 0px 0px; }
          to   { background-position: 240px 240px; }
        }
        .auth-pattern {
          background-image: ${authPatternUrl};
          background-size: ${authPatternSize};
          animation: diagonalScroll 14s linear infinite;
        }
      `}</style>
      <div className="auth-pattern absolute inset-0 pointer-events-none" />

      {/* Overlay fullscreen com logo girando — aparece após 250ms de loading */}
      {showFullscreenLoader && (
        <div
          className="fixed inset-0 z-30 bg-blue-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200"
          aria-hidden="true"
        >
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#3b82f6,#8b5cf6,#06b6d4,#3b82f6)] animate-spin [animation-duration:1.6s] blur-[3px] opacity-90" />
            <div className="absolute inset-[4px] rounded-full bg-blue-950" />
            <div className="absolute inset-[8px] rounded-full overflow-hidden shadow-inner ring-1 ring-blue-300/40">
              <img src="/flowfunnel-logo.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -inset-2 rounded-full border border-blue-300/40 animate-ping [animation-duration:1.8s]" />
          </div>
          <p className="text-white text-lg font-semibold mt-8 tracking-wide">Entrando...</p>
          <p className="text-blue-200 text-sm mt-2">Preparando seu painel</p>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full overflow-hidden shadow-2xl ring-2 ring-white/20">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl sm:text-3xl font-bold text-white">FlowFunnel</span>
          </Link>
          <p className="text-blue-200 text-sm sm:text-base">Entre na sua conta</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} method="post" action="/login" className="space-y-4">
            {!twoFactorRequired ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      suppressHydrationWarning
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      suppressHydrationWarning
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="off"
                      className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link href="/forgot-password" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <p className="text-sm">
                    {useRecovery
                      ? 'Digite um dos seus códigos de recuperação.'
                      : 'Digite o código de 6 dígitos do seu app autenticador.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {useRecovery ? 'Código de recuperação' : 'Código de verificação'}
                  </label>
                  <input
                    type="text"
                    name="totp"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value)}
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    autoFocus
                    className="w-full px-4 py-3 text-center tracking-[0.4em] text-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={resetToFirstStep}
                    className="text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    ← Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUseRecovery(!useRecovery); setTotp(''); setError('') }}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {useRecovery ? 'Usar código do app' : 'Usar código de recuperação'}
                  </button>
                </div>
              </>
            )}

            <button
              suppressHydrationWarning
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {twoFactorRequired ? 'Verificando...' : 'Entrando...'}</>
              ) : (twoFactorRequired ? 'Verificar' : 'Entrar')}
            </button>
          </form>

          {!twoFactorRequired && (
          <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-900 text-gray-400">Ou continue com</span>
            </div>
          </div>

          <button
            suppressHydrationWarning
            onClick={handleGoogleLogin}
            className="w-full border border-gray-300 dark:border-gray-600 py-3 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>
          </>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Não tem uma conta?{' '}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Criar conta grátis
            </Link>
          </p>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
            <Link href="/termos" className="hover:underline">Termos de Uso</Link>
            <span className="mx-2">·</span>
            <Link href="/privacidade" className="hover:underline">Privacidade</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
