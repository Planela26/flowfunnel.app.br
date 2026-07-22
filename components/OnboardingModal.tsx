'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  MessageCircle, Webhook, BarChart2, ArrowRight, X, CheckCircle,
  Users, Target, Zap, ChevronRight
} from 'lucide-react'

interface Step {
  icon: React.ReactNode
  title: string
  description: string
  checklist?: string[]
  action?: { label: string; href: string } | null
}

const steps: Step[] = [
  {
    icon: <Zap className="w-10 h-10 text-blue-600" />,
    title: 'Bem-vindo ao FlowFunnel Funnel!',
    description: 'Rastreie seu funil completo — do anúncio até a venda — em tempo real. Vamos configurar tudo em 4 passos rápidos.',
    checklist: [
      'Conectar suas plataformas de venda',
      'Configurar seu número do WhatsApp',
      'Criar metas de conversão',
      'Convidar seu time',
    ],
    action: null,
  },
  {
    icon: <Webhook className="w-10 h-10 text-orange-500" />,
    title: 'Conecte suas plataformas de venda',
    description: 'Integre Hotmart, Kiwify, Eduzz, Monetizze ou Perfect Pay para que as vendas apareçam automaticamente no painel.',
    checklist: [
      'Acesse Configurações → Plataforma de venda',
      'Escolha sua plataforma e siga o tutorial',
      'Cole a URL de webhook fornecida',
    ],
    action: { label: 'Ir para Configurações', href: '/settings' },
  },
  {
    icon: <MessageCircle className="w-10 h-10 text-green-500" />,
    title: 'Conecte seu WhatsApp',
    description: 'Adicione seus números de WhatsApp Business com conta verificada para rastrear conversas, leads qualificados e a jornada dos seus clientes.',
    checklist: [
      'Vá em "Meus Números" no menu lateral',
      'Adicione seu número com DDD',
      'Copie a URL de webhook para o seu provedor',
    ],
    action: { label: 'Ir para Meus Números', href: '/whatsapp-numbers' },
  },
  {
    icon: <Target className="w-10 h-10 text-purple-600" />,
    title: 'Defina suas metas',
    description: 'Crie metas de vendas, leads e conversão para acompanhar seu progresso em tempo real e receber alertas.',
    checklist: [
      'Acesse "Metas" no menu lateral',
      'Crie sua primeira meta de vendas',
      'Defina o período e o valor alvo',
    ],
    action: { label: 'Criar primeira meta', href: '/goals' },
  },
  {
    icon: <Users className="w-10 h-10 text-indigo-600" />,
    title: 'Convide seu time',
    description: 'Adicione gestores de tráfego, closers e parceiros para colaborar no painel sem compartilhar sua senha.',
    checklist: [
      'Vá em "Time" no menu lateral',
      'Insira o e-mail do membro',
      'Defina a permissão: Visualizador, Editor ou Admin',
    ],
    action: { label: 'Gerenciar time', href: '/settings/team' },
  },
  {
    icon: <BarChart2 className="w-10 h-10 text-teal-600" />,
    title: 'Seu funil está pronto!',
    description: 'Assim que os primeiros dados chegarem, você verá métricas em tempo real, funil de conversão e sugestões inteligentes.',
    action: { label: 'Ver o Dashboard', href: '/dashboard' },
  },
]

export default function OnboardingModal() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)

  // Chave por usuário — assim contas diferentes no mesmo navegador veem o tutorial uma vez cada
  const guardKey = session?.user?.id ? `onboarding_done:${session.user.id}` : null

  useEffect(() => {
    if (status !== 'authenticated' || !guardKey) return
    // Guard local — se já foi dispensado por esta conta neste navegador, nunca mostra de novo
    if (typeof window !== 'undefined' && localStorage.getItem(guardKey) === '1') {
      setReady(true)
      return
    }
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return
        const completed = Boolean(data?.user?.onboardingCompleted)
        if (completed) {
          try { localStorage.setItem(guardKey, '1') } catch {}
        } else {
          setVisible(true)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [status, guardKey])

  const dismiss = () => {
    setVisible(false)
    // Marca local imediatamente para não reaparecer mesmo se a navegação cancelar o POST
    if (guardKey) { try { localStorage.setItem(guardKey, '1') } catch {} }
    // keepalive garante que a requisição complete mesmo durante navegação de página
    fetch('/api/account/onboarding', { method: 'POST', keepalive: true }).catch(() => {})
  }

  const next = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  const handleAction = (href: string) => {
    dismiss()
    router.push(href)
  }

  if (!ready || !visible) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              {current.icon}
            </div>
            <button onClick={dismiss} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{current.title}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">{current.description}</p>

          {current.checklist && (
            <ul className="space-y-2 mb-5">
              {current.checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200 dark:bg-gray-700'}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {current.action && (
                <button
                  onClick={() => handleAction(current.action!.href)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-xl text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                >
                  {current.action.label}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
              >
                {isLast ? 'Começar' : 'Próximo'}
                {!isLast && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
