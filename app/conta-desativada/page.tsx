import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import SairButton from './SairButton'

// Sempre dinâmica: o estado da conta pode mudar a qualquer momento (o admin
// reativa) e uma versão cacheada mostraria o aviso a quem já voltou ao normal.
export const dynamic = 'force-dynamic'

/**
 * Aviso de conta desativada.
 *
 * Quem está desativado consegue entrar — o middleware é que traz para cá. Isso
 * é proposital: barrar no login fazia a pessoa ler "email ou senha incorretos",
 * porque a tela de login achata qualquer falha nessa frase. Alguém com a senha
 * certa concluía que a senha tinha quebrado e tentava redefinir em looping.
 *
 * O motivo é lido do banco, não do token: se o admin reativar a conta enquanto
 * a pessoa está com esta página aberta, um F5 já a devolve ao sistema.
 */
export default async function ContaDesativadaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, deactivatedAt: true, deactivatedReason: true },
  })

  // Conta normal caiu aqui (link direto, reativação recém-feita): devolve ao
  // sistema em vez de mostrar um aviso que não vale mais.
  if (!user?.deactivatedAt) redirect('/dashboard')

  const desdeQuando = new Date(user.deactivatedAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-500/30 bg-gray-900 shadow-2xl">
        <div className="flex flex-col items-center px-6 pt-10 pb-2">
          {/* Tomada na parede com o plugue puxado para fora. A cara triste está
              nos próprios furos da tomada — os dois contatos viram os olhos. */}
          <svg
            viewBox="0 0 260 150"
            className="h-36 w-full max-w-[260px]"
            role="img"
            aria-label="Ilustração de um plugue desconectado de uma tomada de parede"
          >
            {/* sombra suave atrás da tomada */}
            <ellipse cx="72" cy="132" rx="46" ry="7" fill="#000" opacity="0.35" />

            {/* espelho da tomada */}
            <rect x="30" y="28" width="84" height="96" rx="14" fill="#1f2937" stroke="#374151" strokeWidth="2" />
            <rect x="40" y="38" width="64" height="76" rx="10" fill="#111827" />

            {/* olhos = contatos da tomada */}
            <rect x="55" y="58" width="9" height="20" rx="4.5" fill="#f59e0b" />
            <rect x="80" y="58" width="9" height="20" rx="4.5" fill="#f59e0b" />

            {/* boca virada para baixo */}
            <path
              d="M58 96 Q72 84 86 96"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* plugue, já fora da tomada, com os pinos voltados para ela */}
            <g transform="translate(150 52)">
              <rect x="14" y="0" width="46" height="46" rx="12" fill="#374151" stroke="#4b5563" strokeWidth="2" />
              <rect x="2" y="10" width="14" height="7" rx="3.5" fill="#9ca3af" />
              <rect x="2" y="29" width="14" height="7" rx="3.5" fill="#9ca3af" />
              {/* fio caindo para fora do quadro */}
              <path
                d="M60 23 Q86 23 92 52 Q97 78 74 92"
                fill="none"
                stroke="#4b5563"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </g>

            {/* faíscas curtas no vão entre os dois, sinalizando a desconexão */}
            <g stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" opacity="0.85">
              <path d="M124 62 l10 -7" />
              <path d="M126 75 l12 0" />
              <path d="M124 88 l10 7" />
            </g>
          </svg>

          <h1 className="mt-4 text-center text-2xl font-bold text-white">
            Conta desativada
          </h1>
          <p className="mt-2 text-center text-sm text-gray-400">
            {user.name ? `${user.name} · ` : ''}{user.email}
          </p>
        </div>

        <div className="space-y-5 px-6 pb-8 pt-4">
          {user.deactivatedReason ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Motivo
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-100">
                {user.deactivatedReason}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-4">
              <p className="text-sm leading-relaxed text-gray-300">
                O acesso desta conta foi suspenso pela administração. Nenhum motivo
                específico foi registrado.
              </p>
            </div>
          )}

          <p className="text-sm leading-relaxed text-gray-300">
            Seus dados continuam salvos — nada foi apagado. Assim que a conta for
            reativada, tudo volta exatamente como estava.
          </p>

          <p className="text-xs text-gray-500">
            Desativada em {desdeQuando}. Se você acredita que houve um engano,
            responda ao e-mail de suporte com o endereço acima que a gente revisa.
          </p>

          <SairButton />
        </div>
      </div>
    </div>
  )
}
