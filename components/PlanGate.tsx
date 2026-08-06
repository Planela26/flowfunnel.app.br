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
    <div className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:hover:translate-y-0">
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
          <div className="relative mx-auto w-14 h-14 mb-3">
            <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-md group-hover:bg-amber-400/45 transition-colors duration-300" />
            <div className="relative w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center shadow-lg">
              <Lock className="w-7 h-7 text-white" />
            </div>
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
            className="group/cta inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-5 py-2.5 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
