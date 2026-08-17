import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { getBaseUrl } from '@/lib/base-url'
import { generateSlug, validateDestination } from '@/lib/tracking-link'
import { logAudit } from '@/lib/audit'

const MAX_SITES = 50
const LABEL_MAX = 80

function comLink(site: { slug: string } & Record<string, any>) {
  return { ...site, trackingUrl: `${getBaseUrl()}/r/${site.slug}` }
}

// ── GET: landing pages cadastradas ───────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const sites = await prisma.trackedSite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, slug: true, label: true, destinationUrl: true,
      isActive: true, lastVisitAt: true, visitCount: true, createdAt: true,
    },
  })

  return NextResponse.json({ sites: sites.map(comLink) })
}

// ── POST: cadastrar landing page e gerar o link ──────────────────────────────
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(`track:sites:create:${session.user.id}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 })

  const body = await request.json().catch(() => ({} as any))

  const destino = validateDestination(body?.destinationUrl)
  if (!destino.ok) return NextResponse.json({ error: destino.error }, { status: 400 })

  const label = typeof body?.label === 'string' && body.label.trim()
    ? body.label.trim().slice(0, LABEL_MAX)
    : new URL(destino.url).hostname

  const total = await prisma.trackedSite.count({ where: { userId: session.user.id } })
  if (total >= MAX_SITES) {
    return NextResponse.json(
      { error: `Limite de ${MAX_SITES} links atingido. Remova algum antes de criar outro.` },
      { status: 409 },
    )
  }

  // Colisão de slug é improvável (8 caracteres num alfabeto de 32), mas
  // improvável não é impossível — e uma colisão mandaria o tráfego de um
  // cliente para a página de outro. Tentar de novo custa quase nada.
  let site: any = null
  for (let tentativa = 0; tentativa < 5 && !site; tentativa++) {
    try {
      site = await prisma.trackedSite.create({
        data: {
          userId: session.user.id,
          slug: generateSlug(),
          label,
          destinationUrl: destino.url,
        },
        select: {
          id: true, slug: true, label: true, destinationUrl: true,
          isActive: true, lastVisitAt: true, visitCount: true, createdAt: true,
        },
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
    }
  }
  if (!site) return NextResponse.json({ error: 'Não foi possível gerar o link. Tente novamente.' }, { status: 500 })

  await logAudit({
    action: 'tracking.site_created',
    result: 'success',
    userId: session.user.id,
    entityType: 'TrackedSite',
    entityId: site.id,
    request,
    metadata: { destinationUrl: destino.url },
  })

  return NextResponse.json({ site: comLink(site) }, { status: 201 })
}

// ── PATCH: renomear, trocar destino, ativar/desativar ────────────────────────
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({} as any))
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const data: any = {}
  if (typeof body.label === 'string' && body.label.trim()) data.label = body.label.trim().slice(0, LABEL_MAX)
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.destinationUrl !== undefined) {
    const destino = validateDestination(body.destinationUrl)
    if (!destino.ok) return NextResponse.json({ error: destino.error }, { status: 400 })
    data.destinationUrl = destino.url
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 })

  // updateMany com userId no filtro: é o que impede editar o link de outra
  // conta passando um id alheio. Mesmo padrão de /api/team.
  const r = await prisma.trackedSite.updateMany({ where: { id, userId: session.user.id }, data })
  if (r.count !== 1) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })

  const site = await prisma.trackedSite.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true, slug: true, label: true, destinationUrl: true,
      isActive: true, lastVisitAt: true, visitCount: true, createdAt: true,
    },
  })
  return NextResponse.json({ site: site ? comLink(site) : null })
}

// ── DELETE: remover link ─────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // As visitas já registradas NÃO são apagadas: elas vivem em TrackedLead e
  // TrackedEvent e continuam valendo para relatório e atribuição. Apagar o link
  // só interrompe novos cliques.
  const r = await prisma.trackedSite.deleteMany({ where: { id, userId: session.user.id } })
  if (r.count !== 1) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
