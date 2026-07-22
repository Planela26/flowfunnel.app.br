import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const statuses = await prisma.leadStatus.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ statuses })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { phone, name, email, stage, notes } = await request.json()
  if (!phone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })

  const status = await prisma.leadStatus.upsert({
    where: { userId_phone: { userId: session.user.id, phone } },
    create: { userId: session.user.id, phone, name, email, stage: stage || 'NOVO', notes },
    update: { name: name || undefined, email: email || undefined, stage: stage || undefined, notes: notes || undefined },
  })

  return NextResponse.json({ status })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { phone, stage, notes } = await request.json()
  if (!phone || !stage) return NextResponse.json({ error: 'Telefone e stage obrigatórios' }, { status: 400 })

  const status = await prisma.leadStatus.upsert({
    where: { userId_phone: { userId: session.user.id, phone } },
    create: { userId: session.user.id, phone, stage, notes },
    update: { stage, notes: notes !== undefined ? notes : undefined },
  })

  return NextResponse.json({ status })
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })

  await prisma.leadStatus.deleteMany({
    where: { userId: session.user.id, phone },
  })

  return NextResponse.json({ ok: true })
}
