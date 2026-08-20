'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { usePlan } from './usePlan'

/**
 * Aviso de bloqueio comercial no topo — plano vencido, assinatura inativa,
 * teste encerrado ou conta desativada.
 *
 * NÃO bloqueia a tela, não cobre a interface e não impede cliques: o usuário
 * continua vendo e navegando por todos os dados já existentes. Apenas comunica
 * que NÃO entrarão novos dados/leads/atualizações até regularizar.
 *
 * O texto e o destino vêm de `/api/plan`, que os obtém de
 * `resolveCommercialAccess` — a MESMA função que o gate das integrações usa.
 * Antes este componente consultava `/api/subscription/status` e montava a frase
 * por conta própria: dizia "Seu plano está vencido" para quem só tinha o teste
 * grátis encerrado, e não aparecia para quem nunca assinou — que descobria o
 * bloqueio ao tentar conectar uma integração, na forma do código cru
 * `card_required`. Lendo a decisão pronta, tela e gate não têm como divergir.
 */
export default function PlanExpiredBanner() {
  const router = useRouter()
  const { info, loading } = usePlan()
  const [dismissed, setDismissed] = useState(false)

  if (loading || dismissed) return null
  if (!info.accessDenialCode || !info.accessMessage) return null

  // Teste EM CURSO tem narrativa própria (dias restantes, "assinar agora") e é
  // do TrialBanner, logo abaixo deste no AppShell. Sem esta guarda os dois
  // apareceriam juntos falando do mesmo assunto.
  if (info.trialActive) return null

  const desativada = info.accessDenialCode === 'account_deactivated'
  const expirado = info.accessDenialCode === 'plan_expired'

  const rotuloBotao = desativada
    ? 'Falar com o suporte'
    : expirado
    ? 'Renovar assinatura'
    : 'Ver planos'

  return (
    <div
      className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm border-b ${
        desativada
          ? 'bg-red-900/70 border-red-600/40'
          : 'bg-amber-900/70 border-amber-600/40'
      }`}
    >
      <AlertTriangle
        className={`w-4 h-4 flex-shrink-0 ${desativada ? 'text-red-300' : 'text-amber-400'}`}
      />
      <span className={`flex-1 font-medium ${desativada ? 'text-red-100' : 'text-amber-100'}`}>
        {info.accessMessage}
      </span>
      <button
        onClick={() => router.push(info.accessActionUrl || '/billing')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition text-gray-900 ${
          desativada ? 'bg-red-400 hover:bg-red-300' : 'bg-amber-500 hover:bg-amber-400'
        }`}
      >
        <RefreshCw className="w-3 h-3" />
        {rotuloBotao}
      </button>
      {/* Conta desativada não se dispensa: não há ação do usuário que resolva,
          e esconder o aviso o deixaria sem explicação para o que não funciona. */}
      {!desativada && (
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-300/70 hover:text-white transition flex-shrink-0"
          title="Fechar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
