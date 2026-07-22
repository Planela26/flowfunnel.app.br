import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const members = await prisma.teamMember.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ members })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { email, name, role } = await request.json()
  if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

  const existing = await prisma.teamMember.findUnique({
    where: { ownerId_email: { ownerId: session.user.id, email } },
  })
  if (existing) return NextResponse.json({ error: 'Membro já convidado' }, { status: 400 })

  const token = crypto.randomBytes(32).toString('hex')

  const member = await prisma.teamMember.create({
    data: {
      ownerId: session.user.id,
      email,
      name: name || null,
      role: role || 'VIEWER',
      status: 'PENDING',
      token,
    },
  })

  const inviter = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
  sendTeamInviteEmail(email, inviter?.name || 'Seu gestor', token).catch(() => {})

  return NextResponse.json({ member })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, role } = await request.json()
  if (!id || !role) return NextResponse.json({ error: 'Dados obrigatórios' }, { status: 400 })

  const member = await prisma.teamMember.updateMany({
    where: { id, ownerId: session.user.id },
    data: { role },
  })

  return NextResponse.json({ member })
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  await prisma.teamMember.deleteMany({ where: { id, ownerId: session.user.id } })

  return NextResponse.json({ ok: true })
}
