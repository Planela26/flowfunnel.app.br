import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { affiliateId } = await request.json()
    if (!affiliateId) return NextResponse.json({ error: 'affiliateId obrigatório' }, { status: 400 })

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || null
    const userAgent = headersList.get('user-agent') || null

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true, isActive: true },
    })

    if (!affiliate || !affiliate.isActive) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
    }

    await prisma.affiliateClick.create({
      data: { affiliateId, ip, userAgent },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
