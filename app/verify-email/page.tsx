'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  Mail,
  Loader2,
  ArrowRight,
  Zap,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'

function VerifyEmailInner() {
  const params = useSearchParams()
  const router = useRouter()
  const status = params.get('status')
  const { update } = useSession()
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  // Decide o destino pós-verificação: quem registrou querendo trial
  // (trialStatus === 'pending_payment') vai direto ativar o teste grátis
  // via Stripe; os demais vão pro painel.
  const resolveDest = async (): Promise<string> => {
    try {
      const res = await fetch('/api/plan')
      if (res.ok) {
        const data = await res.json()
        if (data?.trialStatus === 'pending_payment' && data?.trialPlan) {
          return `/activate-trial?plan=${data.trialPlan}`
        }
      }
    } catch {
      // ignora — cai no painel
    }
    return '/dashboard'
  }

  // Navegação full-reload: força o browser a fazer novo request ao servidor,
  // garantindo que o middleware leia o token JWT atualizado (não o stale).
  const goTo = (dest: string) => {
    window.location.href = dest
  }

  // Ao confirmar com sucesso, força refresh do token e redireciona.
  useEffect(() => {
    if (status !== 'success') return
    let cancelled = false
    setRedirecting(true)
    const timer = setTimeout(() => {
      ;(async () => {
        try {
          await update()
        } catch {
          // ignora
        }
        const dest = await resolveDest()
        if (!cancelled) goTo(dest)
      })()
    }, 3000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [status, update, router])

  const resend = async () => {
    setResending(true)
    setResendMsg(null)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResendMsg('Email reenviado! Verifique sua caixa de entrada.')
    } catch (err: any) {
      setResendMsg(err.message)
    } finally {
      setResending(false)
    }
  }

  const goToDashboard = async () => {
    const dest = await resolveDest()
    goTo(dest)
  }

  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)

  const checkVerified = async () => {
    setChecking(true)
    setCheckMsg(null)
    try {
      const res = await fetch('/api/auth/me')
      if (res.status === 401) {
        setCheckMsg('❌ Você precisa estar logado. Redirecionando para o login...')
        setTimeout(() => goTo('/login'), 2000)
        return
      }
      const data = await res.json()
      if (data?.user?.emailVerified) {
        setCheckMsg('✅ Email verificado! Liberando acesso...')
        await update()
        const dest = await resolveDest()
        goTo(dest)
      } else {
        setCheckMsg('❌ Email ainda não verificado. Clique no link que enviamos para sua caixa de entrada.')
      }
    } catch (err: any) {
      setCheckMsg(`Erro ao verificar: ${err.message || 'Tente novamente.'}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 bg-[#0c1426] border-b border-white/5 shadow-xl">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight leading-none">FlowFunnel</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login"
              className="text-sm font-medium text-blue-200 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition">
              Entrar
            </Link>
            <Link href="/register"
              className="text-sm font-bold bg-white text-blue-800 hover:bg-blue-50 px-5 py-2 rounded-lg transition shadow-sm">
              Começar Grátis
            </Link>
          </nav>
        </div>
      </header>

      {/* ── HERO / STATUS ── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex-1 flex items-center justify-center px-4 py-16">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400/10 via-transparent to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />

        <div className="relative max-w-lg w-full">
          {/* Success State */}
          {status === 'success' && (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-center">
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-10">
                <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3">
                  Email verificado com sucesso!
                </h1>
                <p className="text-gray-600 text-base leading-relaxed mb-2">
                  Sua conta está pronta e liberada. Você pode acessar o painel agora e começar a rastrear seu funil.
                </p>
                {redirecting && (
                  <p className="text-blue-600 text-sm font-medium mt-2 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecionando para o painel…
                  </p>
                )}
              </div>
              <div className="p-6 bg-gray-50">
                <button
                  onClick={goToDashboard}
                  className="inline-flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl transition"
                >
                  Ir para o painel
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="mt-3 text-xs text-gray-400">
                  Se não for redirecionado automaticamente, clique acima.
                </p>
              </div>
            </div>
          )}

          {/* Error / Invalid State */}
          {(status === 'invalid' || status === 'missing' || status === 'error') && (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-center">
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-10">
                <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
                  <XCircle className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3">
                  Link inválido ou expirado
                </h1>
                <p className="text-gray-600 text-base leading-relaxed mb-6">
                  Este link de verificação não é mais válido. Pode ser que já tenha sido usado, ou que tenha expirado. Não se preocupe — podemos enviar um novo email.
                </p>
                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-3 text-sm font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  Os links expiram em 24h por segurança.
                </div>
              </div>
              <div className="p-6 bg-gray-50 space-y-3">
                <button
                  onClick={resend}
                  disabled={resending}
                  className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl transition disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {resending ? 'Enviando…' : 'Reenviar email de verificação'}
                </button>
                {resendMsg && (
                  <p className="text-sm text-emerald-600 font-medium bg-emerald-50 rounded-lg px-3 py-2">
                    {resendMsg}
                  </p>
                )}
                <Link href="/login"
                  className="inline-flex items-center justify-center gap-2 w-full text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-xl text-sm transition">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o login
                </Link>
              </div>
            </div>
          )}

          {/* No status / Waiting State */}
          {!status && (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-center">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-10">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
                  <Mail className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3">
                  Verifique seu email
                </h1>
                <p className="text-gray-600 text-base leading-relaxed mb-6">
                  Enviamos um link de confirmação para o email cadastrado. Clique no link para liberar todos os recursos da sua conta.
                </p>
                <div className="flex items-center justify-center gap-2 text-blue-700 bg-blue-100 rounded-xl px-4 py-3 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Não recebeu? Verifique a pasta Spam ou Lixo Eletrônico.
                </div>
              </div>
              <div className="p-6 bg-gray-50 space-y-3">
                <button
                  onClick={checkVerified}
                  disabled={checking}
                  className="inline-flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl transition disabled:opacity-50"
                >
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {checking ? 'Verificando...' : 'Já verifiquei — Liberar acesso'}
                </button>
                {checkMsg && (
                  <p className={`text-sm font-medium rounded-lg px-3 py-2 ${checkMsg.startsWith('✅') ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                    {checkMsg}
                  </p>
                )}
                <button
                  onClick={resend}
                  disabled={resending}
                  className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl transition disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {resending ? 'Enviando...' : 'Reenviar email de confirmação'}
                </button>
                {resendMsg && (
                  <p className="text-sm text-emerald-600 font-medium bg-emerald-50 rounded-lg px-3 py-2">
                    {resendMsg}
                  </p>
                )}
                <Link href="/login"
                  className="inline-flex items-center justify-center gap-2 w-full text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-xl text-sm transition">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o login
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-950 text-white py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold text-gray-200">FlowFunnel</span>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/termos" className="text-gray-500 hover:text-white transition">Termos de Uso</Link>
            <Link href="/privacidade" className="text-gray-500 hover:text-white transition">Privacidade</Link>
            <Link href="/lgpd" className="text-gray-500 hover:text-white transition">LGPD</Link>
          </div>
          <p className="text-gray-600 text-sm">© 2026 FlowFunnel</p>
        </div>
      </footer>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  )
}
