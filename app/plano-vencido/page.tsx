import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { isPlanExpired } from '@/lib/plan-expiry'
import { AlertTriangle } from 'lucide-react'
import PagarButton from './PagarButton'

// Sempre dinâmica: o pagamento pode entrar a qualquer momento e uma versão
// cacheada manteria o aviso na frente de quem já renovou.
export const dynamic = 'force-dynamic'

/**
 * Aviso de plano vencido.
 *
 * O período de 30 dias acabou sem renovação. Diferente do teste grátis
 * expirado, que deixa a conta em modo somente leitura, aqui a navegação é
 * interrompida pelo middleware e a pessoa cai nesta tela: ela pagou, o período
 * terminou, e o próximo passo é renovar.
 *
 * A conta NÃO volta para o plano gratuito — o plano contratado continua
 * registrado, então renovar devolve exatamente o que ela tinha, sem
 * reconfigurar nada.
 */
export default async function PlanoVencidoPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, plan: true, planExpiresAt: true },
  })

  // Renovou enquanto a tela estava aberta (ou caiu aqui por engano): devolve
  // ao sistema em vez de mostrar um aviso que não vale mais.
  if (!user || !isPlanExpired(user)) redirect('/dashboard')

  const venceuEm = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  const plano = (user.plan || 'START').toUpperCase()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-gray-900 shadow-2xl">
        <div className="flex items-start gap-4 border-b border-gray-800 bg-red-500/10 px-6 py-5">
          <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              Não conseguimos renovar o seu plano
            </h1>
            <p className="mt-1 text-sm text-red-300">
              Atualize sua forma de pagamento para voltar a usar
            </p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-gray-300">
            O período do seu plano <strong className="text-white">{plano}</strong>
            {venceuEm ? <> terminou em <strong className="text-white">{venceuEm}</strong></> : ' terminou'} e
            o acesso está suspenso até a renovação.
          </p>

          <div className="rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-4">
            <p className="text-sm leading-relaxed text-gray-300">
              Nada foi apagado. Seus funis, leads, integrações e histórico continuam
              exatamente como estavam — assim que o pagamento for confirmado, tudo
              volta no mesmo lugar.
            </p>
          </div>

          <PagarButton plan={plano} />

          <p className="text-center text-xs text-gray-500">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  )
}
