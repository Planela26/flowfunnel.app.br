'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, Mail, Lock, User, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { authPatternUrl, authPatternSize } from '@/lib/authPattern'

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  )
}

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    plan: (planParam || 'start').toLowerCase()
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [termsScrolled, setTermsScrolled] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [emailHint, setEmailHint] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  useEffect(() => {
    const email = formData.email.trim()
    if (!email) { setEmailStatus('idle'); setEmailHint(''); return }
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!looksLikeEmail) { setEmailStatus('idle'); setEmailHint(''); return }

    setEmailStatus('checking')
    setEmailHint('Verificando email...')
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        const data = await res.json()
        if (ctrl.signal.aborted) return
        if (data.valid) {
          setEmailStatus('valid')
          setEmailHint('Email válido')
        } else if (data.reason === 'rate_limited') {
          setEmailStatus('idle')
          setEmailHint('')
        } else {
          setEmailStatus('invalid')
          setEmailHint(data.reason === 'no_mx'
            ? 'Esse domínio não recebe emails. Confira se digitou certo.'
            : 'Email inválido.')
        }
      } catch {
        if (!ctrl.signal.aborted) {
          setEmailStatus('idle')
          setEmailHint('')
        }
      }
    }, 700)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [formData.email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (formData.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }

    if (!termsScrolled || !acceptedTerms) {
      setError('Leia os termos até o final e aceite para continuar')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }
      // Meta Pixel: CompleteRegistration, using the SAME event_id returned by
      // the backend so it dedups against the CAPI event. (StartTrial fires later,
      // only when the trial is actually activated with a card.)
      if (typeof window !== 'undefined' && typeof window.fbq === 'function' && data.meta?.completeRegistration?.eventId) {
        window.fbq('track', 'CompleteRegistration', {}, { eventID: data.meta.completeRegistration.eventId })
      }

      setSuccess(true)
      setTimeout(() => {
        signIn('credentials', {
          email: formData.email,
          password: formData.password,
          callbackUrl: '/dashboard',
        })
      }, 1000)
    } catch {
      setError('Erro ao registrar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4 overflow-hidden">
      <style>{`
        @keyframes diagonalScrollReg {
          from { background-position: 0px 0px; }
          to   { background-position: 240px 240px; }
        }
        .auth-pattern-reg {
          background-image: ${authPatternUrl};
          background-size: ${authPatternSize};
          animation: diagonalScrollReg 14s linear infinite;
        }
      `}</style>
      <div className="auth-pattern-reg absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full overflow-hidden shadow-2xl ring-2 ring-white/20">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl sm:text-3xl font-bold text-white">FlowFunnel</span>
          </Link>
          {planParam && ['START', 'PRO', 'SCALE'].includes(planParam.toUpperCase()) ? (
            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/40 text-green-200 text-sm font-semibold px-4 py-2 rounded-full">
              <Check className="w-4 h-4" />
              7 dias grátis do Plano {planParam.toUpperCase()} — sem cobrança durante o teste
            </div>
          ) : (
            <p className="text-blue-200">Crie sua conta gratuitamente</p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 sm:p-8">
          {success ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-900 dark:text-white font-semibold text-lg mb-1">
                Conta criada com sucesso!
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                {planParam && ['START', 'PRO', 'SCALE'].includes(planParam.toUpperCase())
                  ? `Enviamos um email de confirmação. Verifique sua caixa de entrada para ativar o teste grátis do Plano ${planParam.toUpperCase()}.`
                  : 'Enviamos um email de confirmação. Verifique sua caixa de entrada para acessar o painel.'
                }
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} method="post" action="/register" className="space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    required
                  />
                </div>
                {emailHint && (
                  <p className={`text-xs ${
                    emailStatus === 'valid' ? 'text-green-600 dark:text-green-400' :
                    emailStatus === 'invalid' ? 'text-red-600 dark:text-red-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {emailHint}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
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

              <div className="flex flex-col gap-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repita a senha"
                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="plan" className="text-sm font-medium text-gray-700 dark:text-gray-300">Plano</label>
                <select
                  id="plan"
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="start">START</option>
                  <option value="pro">PRO</option>
                  <option value="scale">SCALE</option>
                </select>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-black text-amber-900 dark:text-amber-300">Termos de uso e privacidade</p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-1">
                      Leia com atenção antes de continuar.
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${termsScrolled ? 'bg-green-600 text-white' : 'bg-amber-200 text-amber-900'}`}>
                    {termsScrolled ? 'Lido' : 'Leia até o fim'}
                  </span>
                </div>
                <div
                  onScroll={(e) => {
                    const target = e.currentTarget
                    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 8) {
                      setTermsScrolled(true)
                    }
                  }}
                  className="max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-4"
                >
                  <p className="font-bold text-gray-900 dark:text-white">1. Serviço FlowFunnel</p>
                  <p>
                    O FlowFunnel organiza funis, métricas, integrações e automações para captação, acompanhamento e análise de leads e vendas.
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">2. WhatsApp Business e conta verificada</p>
                  <p>
                    Quando o plano ou recurso exigir conexão oficial com a API da Meta, pode ser necessário possuir conta verificada do WhatsApp Business. Sem isso, alguns recursos podem não funcionar ou não ser liberados.
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">3. Integrações e recursos</p>
                  <p>
                    Dependendo do plano, o usuário pode acessar recursos de visualização, integração oficial, métricas avançadas, IA e automações. Recursos premium podem exigir assinatura ativa.
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">4. Privacidade e dados</p>
                  <p>
                    Os dados cadastrados, tokens de integração e informações de uso são tratados para operação da plataforma, exibição de métricas e suporte técnico.
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">5. Segurança e criptografia</p>
                  <p>
                    Os dados são protegidos com padrões de segurança em trânsito e em repouso. <strong>Seus dados são tratados com alto nível de proteção</strong> e, na prática operacional da plataforma, <strong>nem a FlowFunnel acessa o conteúdo sensível da sua conta</strong> sem necessidade técnica e permissão adequada.
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">6. Responsabilidade do usuário</p>
                  <p>
                    O usuário é responsável por manter suas credenciais, contas verificadas e permissões corretas para uso das integrações.
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">7. Aceite</p>
                  <p>
                    Ao continuar, você declara estar ciente e de acordo com estes termos, com a política de privacidade e com a necessidade de conta verificada quando aplicável.
                  </p>
                </div>
                <label className="mt-3 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Estou ciente e aceito os termos</strong>, incluindo a necessidade de conta verificada do WhatsApp Business quando aplicável.
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !termsScrolled || !acceptedTerms || emailStatus === 'invalid' || emailStatus === 'checking'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="animate-spin w-5 h-5" /> Criando conta...</>
                ) : (
                  <><MessageCircle className="w-5 h-5" /> Criar Conta</>
                )}
              </button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                Já tem uma conta?{' '}
                <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Entrar
                </Link>
              </p>

              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
                <Link href="/termos" className="hover:underline">Termos de Uso</Link>
                <span className="mx-2">·</span>
                <Link href="/privacidade" className="hover:underline">Privacidade</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
