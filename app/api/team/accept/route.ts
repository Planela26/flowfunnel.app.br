import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'

/**
 * Validade do convite, contada a partir de `createdAt`.
 *
 * O modelo TeamMember não tem coluna de expiração e o token vive na URL do
 * e-mail (histórico, referrer, encaminhamento). Derivar a validade de
 * `createdAt` impõe o prazo sem exigir migration de schema.
 */
const INVITE_EXPIRY_DAYS = 7

function isInviteExpired(createdAt: Date): boolean {
  return Date.now() - new Date(createdAt).getTime() > INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
}

export async function GET(request: Request) {
  try {
    const rl = await checkRateLimit(`team:accept:${getClientIp(request.headers)}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { token },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            plan: true,
          },
        },
      },
    })

    if (!member || isInviteExpired(member.createdAt)) {
      return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 404 })
    }

    if (member.status === 'ACTIVE') {
      return NextResponse.json({
        error: 'Este convite já foi aceito',
        member: {
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role,
          status: member.status,
          ownerId: member.ownerId,
        },
      }, { status: 409 })
    }

    return NextResponse.json({
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
        ownerId: member.ownerId,
      },
      owner: member.owner,
    })
  } catch (error) {
    console.error('Erro ao validar convite:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { token },
    })

    if (!member || isInviteExpired(member.createdAt)) {
      return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 404 })
    }

    // Uso único: uma vez ACTIVE, o mesmo token não reativa nada (anti-replay).
    if (member.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Convite já aceito' }, { status: 409 })
    }

    await prisma.teamMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE' },
    })

    return NextResponse.json({ ok: true, memberId: member.id })
  } catch (error) {
    console.error('Erro ao aceitar convite:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
