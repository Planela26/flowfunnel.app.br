'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, X, Zap, TrendingUp, Crown, ArrowLeft } from 'lucide-react'
import { authPatternUrl, authPatternSize } from '@/lib/authPattern'

const plans = [
  {
    id: 'start',
    name: 'START',
    tagline: 'Para quem está começando',
    badge: 'Essencial',
    badgeColor: 'bg-white/20 text-white',
    price: 97,
    icon: <Zap className="w-6 h-6" />,
    iconBg: 'bg-white/20 text-white',
    borderClass: 'border border-white/20',
    cardClass: 'bg-white/10 backdrop-blur-md',
    buttonClass: 'bg-white text-blue-700 hover:bg-blue-50 font-bold',
    buttonText: 'Testar grátis 7 dias',
    popular: false,
    features: [
      { text: 'Análise por IA do funil', included: true },
      { text: 'Até 1.000 conversas iniciadas/mês', included: true },
      { text: 'Identificação de gargalos', included: true },
      { text: 'Insights básicos', included: true },
      { text: '1 número de WhatsApp', included: true },
      { text: '1 funil ativo', included: true },
      { text: 'Comparação de períodos', included: false },
      { text: 'Alertas automáticos', included: false },
      { text: 'Multiusuário (em breve)', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    tagline: 'Para quem anuncia todo dia',
    badge: 'Mais Popular',
    badgeColor: 'bg-white/20 text-white',
    price: 147,
    icon: <TrendingUp className="w-6 h-6" />,
    iconBg: 'bg-white/20 text-white',
    borderClass: 'border-0',
    cardClass: 'bg-gradient-to-b from-blue-600 to-blue-800 text-white',
    buttonClass: 'bg-white text-blue-700 hover:bg-blue-50 font-bold',
    buttonText: 'Testar grátis 7 dias',
    popular: true,
    features: [
      { text: 'Análise completa por IA', included: true },
      { text: 'Até 3.000 conversas iniciadas/mês', included: true },
      { text: 'Diagnóstico + sugestões', included: true },
      { text: 'Insights avançados', included: true },
      { text: 'Até 3 números de WhatsApp', included: true },
      { text: 'Até 3 funis ativos', included: true },
      { text: 'Comparação de períodos', included: true },
      { text: 'Histórico estendido (até 365 dias)', included: true },
      { text: 'Alertas automáticos', included: false },
      { text: 'Multiusuário (em breve)', included: false },
    ],
  },
  {
    id: 'scale',
    name: 'SCALE',
    tagline: 'Para agências e grandes operações',
    badge: 'IA Avançada',
    badgeColor: 'bg-white/20 text-white',
    price: 297,
    icon: <Crown className="w-6 h-6" />,
    iconBg: 'bg-white/20 text-white',
    borderClass: 'border border-white/20',
    cardClass: 'bg-white/10 backdrop-blur-md',
    buttonClass: 'bg-white text-blue-700 hover:bg-blue-50 font-bold',
    buttonText: 'Testar grátis 7 dias',
    popular: false,
    features: [
      { text: 'IA avançada (sugestões + diagnóstico)', included: true },
      { text: 'Conversas iniciadas ilimitadas', included: true },
      { text: 'Histórico estendido (até 365 dias)', included: true },
      { text: 'WhatsApps ilimitados', included: true },
      { text: 'Funis ilimitados', included: true },
      { text: 'Comparação de períodos', included: true },
      { text: 'Alertas automáticos', included: true },
      { text: 'Análise de tendências', included: true },
      { text: 'Multiusuário (em breve)', included: false },
    ],
  },
]

const guarantees = [
  { icon: '🔒', text: 'Pagamento seguro' },
  { icon: '↩️', text: '7 dias de garantia' },
  { icon: '🚀', text: 'Acesso imediato' },
  { icon: '🤝', text: 'Suporte por WhatsApp' },
]

export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [consentPlan, setConsentPlan] = useState<string | null>(null)
  const [termsScrolled, setTermsScrolled] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const currentPlan = consentPlan ? plans.find(p => p.id === consentPlan) || null : null

  // Teste grátis de 7 dias → SEMPRE via Stripe (Mercado Pago não permite trial).
  // Sem conta: cria conta primeiro (após confirmar o email, segue para /activate-trial).
  // Com conta: vai direto para a ativação do trial via Stripe.
  const startTrial = (planId: string) => {
    if (!session) {
      router.push(`/register?plan=${planId.toUpperCase()}`)
      return
    }
    router.push(`/activate-trial?plan=${planId.toUpperCase()}`)
  }

  // Pagar agora → checkout Mercado Pago (PIX/Boleto/Cartão). Página é pública.
  // PRO/SCALE passam pelo aceite de termos antes de seguir para o checkout.
  const payNow = (planId: string) => {
    if (planId === 'start') {
      goToCheckout(planId)
      return
    }
    setConsentPlan(planId)
    setTermsScrolled(false)
    setAcceptedTerms(false)
  }

  const confirmConsent = () => {
    if (!consentPlan || !termsScrolled || !acceptedTerms) return
    const planId = consentPlan
    setConsentPlan(null)
    goToCheckout(planId)
  }

  const goToCheckout = (planId: string) => {
    router.push(`/checkout?plan=${planId.toUpperCase()}`)
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 overflow-hidden">

      {/* Animated pattern — igual ao login */}
      <style>{`
        @keyframes diagonalScroll {
          from { background-position: 0px 0px; }
          to   { background-position: 240px 240px; }
        }
        .pricing-pattern {
          background-image: ${authPatternUrl};
          background-size: ${authPatternSize};
          animation: diagonalScroll 14s linear infinite;
        }
      `}</style>
      <div className="pricing-pattern absolute inset-0 pointer-events-none" />

      {/* Conteúdo */}
      <div className="relative z-10 pt-12 pb-20 px-4">

        {/* Cabeçalho */}
        <div className="text-center mb-10 sm:mb-14">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm mb-4 sm:mb-8 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao Dashboard</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4 leading-tight">
            Planos e Preços
          </h1>
          <p className="text-blue-200 text-base sm:text-lg max-w-xl mx-auto px-2 sm:px-0">
            Escolha o plano ideal para o seu volume de vendas no WhatsApp. Todos incluem análise por inteligência artificial.
          </p>
        </div>

        {/* Cards */}
        <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl shadow-2xl overflow-hidden flex flex-col ${plan.cardClass} ${plan.borderClass} ${plan.popular ? 'md:-mt-6 md:scale-[1.04] z-10' : ''}`}
            >
              {/* Popular ribbon */}
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 text-center py-1.5 bg-white/10 text-white text-xs font-bold uppercase tracking-widest">
                  ⭐ Mais Recomendado
                </div>
              )}

              <div className={`p-7 ${plan.popular ? 'pt-10' : ''} flex flex-col flex-1`}>

                {/* Badge + ícone */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                  <div className={`p-2 rounded-xl ${plan.iconBg}`}>
                    {plan.icon}
                  </div>
                </div>

                {/* Nome + tagline */}
                <h2 className="text-2xl font-extrabold mb-1 text-white">
                  {plan.name}
                </h2>
                <p className="text-sm mb-5 text-blue-200">
                  {plan.tagline}
                </p>

                {/* Preço */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-blue-200">R$</span>
                    <span className="text-5xl font-black text-white">
                      {plan.price}
                    </span>
                  </div>
                  <span className="text-xs text-blue-300">/mês</span>
                </div>

                {/* Botão CTA — teste grátis 7 dias (Stripe) */}
                <button
                  onClick={() => startTrial(plan.id)}
                  className={`w-full py-3 rounded-xl text-sm font-bold text-center transition mb-2 flex items-center justify-center gap-2 ${plan.buttonClass}`}
                >
                  Testar grátis 7 dias
                </button>
                {/* Pagar agora (Mercado Pago — PIX/Boleto/Cartão) */}
                <button
                  onClick={() => payNow(plan.id)}
                  className="w-full py-2 rounded-xl text-xs font-medium text-center transition mb-2 flex items-center justify-center gap-1.5 border border-white/30 text-white/80 hover:bg-white/10"
                >
                  <Zap className="w-3 h-3" />
                  Pagar agora (PIX/Boleto/Cartão)
                </button>
                <p className="text-center text-[11px] text-blue-200/70 mb-6">
                  7 dias grátis · cancele quando quiser
                </p>

                {/* Divider */}
                <div className="border-t border-white/20 mb-5" />

                {/* Feature list */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      {f.included ? (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white/20">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      ) : (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white/10">
                          <X className="w-3 h-3 text-blue-300" />
                        </span>
                      )}
                      <span className={`text-sm ${f.included ? 'text-white' : 'text-blue-300 line-through'}`}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        </div>

        {/* Garantias */}
        <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {guarantees.map((g, i) => (
            <div key={i} className="bg-white/10 border border-white/20 rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 backdrop-blur-sm">
              <span className="text-xl sm:text-2xl">{g.icon}</span>
              <span className="text-xs sm:text-sm font-medium text-white">{g.text}</span>
            </div>
          ))}
        </div>

        {/* Nota */}
        <p className="text-center text-sm text-blue-200 mt-8">
          Os planos são definidos pelo volume de conversas iniciadas rastreadas. Todos incluem inteligência artificial.
        </p>
      </div>

      {currentPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-500 text-white">
              <p className="text-xs uppercase tracking-[0.25em] font-bold opacity-90">Consentimento obrigatório</p>
              <h3 className="text-2xl font-black mt-1">Plano {currentPlan.name}</h3>
              <p className="text-sm text-white/90 mt-1">
                Antes de continuar, leia os termos e confirme que entende a necessidade de conta verificada do WhatsApp Business.
              </p>
            </div>
            <div className="p-6">
              <div
                onScroll={(e) => {
                  const target = e.currentTarget
                  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 8) {
                    setTermsScrolled(true)
                  }
                }}
                className="max-h-80 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-4 text-sm text-gray-700 dark:text-gray-300"
              >
                <p className="font-black text-gray-900 dark:text-white">Termos do plano e privacidade</p>
                <p>
                  O FlowFunnel fornece análise de funis, métricas e integrações. Alguns recursos exigem assinatura ativa e conta verificada do WhatsApp Business.
                </p>
                <p>
                  <strong>WhatsApp verificado é obrigatório no Pro e no Scale</strong> para usar a conexão oficial da API da Meta e as métricas avançadas. Apenas o Start funciona sem conta verificada.
                </p>
                <p>
                  Os dados são tratados com foco em segurança, disponibilidade e privacidade. O acesso a recursos avançados depende do plano contratado.
                </p>
                <p>
                  Ao continuar, você declara estar ciente de que os recursos do plano podem depender de integrações válidas, contas verificadas e permissões corretas.
                </p>
                <p>
                  <strong>Segurança e criptografia:</strong> seus dados são protegidos por padrões de segurança e criptografia durante o tráfego e armazenamento.
                </p>
              </div>

              <label className="mt-4 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Estou ciente e aceito os termos</strong> e confirmo que a conta verificada do WhatsApp Business é necessária quando aplicável.
                </span>
              </label>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setConsentPlan(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmConsent}
                  disabled={!termsScrolled || !acceptedTerms}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
