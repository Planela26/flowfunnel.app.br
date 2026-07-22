import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, emailVerified: true,
      role: true, plan: true, createdAt: true, onboardingCompletedAt: true,
    },
  })
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json(
    {
      authenticated: true,
      user: {
        ...user,
        emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
        onboardingCompleted: user.onboardingCompletedAt !== null,
      },
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    }
  )
}
