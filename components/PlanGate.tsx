'use client'

import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface PlanGateProps {
  /** true => libera o conteúdo. false => mostra blur + lock + CTA */
  unlocked: boolean
  /** Conteúdo real (renderizado normalmente quando unlocked = true; usado como prévia borrada quando false) */
  children: ReactNode
  /** Texto principal exibido sobre o blur */
  title?: string
  /** Texto secundário */
  message?: string
  /** Texto do botão */
  ctaLabel?: string
  /** URL de upgrade */
  href?: string
  /** Plano mínimo necessário (mostrado no badge) */
  requiredPlan?: string
}

export default function PlanGate({
  unlocked,
  children,
  title = 'Análise completa disponível no PRO',
  message = 'Descubra quais leads realmente convertem e onde seu tráfego está sendo desperdiçado.',
  ctaLabel = 'Desbloquear PRO',
  href = '/billing',
  requiredPlan = 'PRO',
}: PlanGateProps) {
  if (unlocked) return <>{children}</>

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Conteúdo real ficando como prévia borrada */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none filter blur-md opacity-60"
      >
        {children}
      </div>

      {/* Overlay de bloqueio */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900/85 via-blue-800/80 to-indigo-900/85 backdrop-blur-[2px]">
        <div className="text-center px-6 py-8 max-w-md">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center mb-3 shadow-lg">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/95 text-amber-950 text-[10px] font-extrabold uppercase tracking-wider mb-2">
            Exclusivo {requiredPlan}
          </div>
          <h3 className="text-white text-lg sm:text-xl font-extrabold mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-blue-100 text-sm mb-5">{message}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-5 py-2.5 rounded-lg shadow-lg transition transform hover:scale-105"
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
