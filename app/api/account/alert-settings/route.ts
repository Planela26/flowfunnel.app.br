import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessFeature } from '@/lib/plans'
import {
  ALERT_RULES,
  DEFAULT_ALERT_SETTINGS,
  parseAlertSettings,
  serializeAlertSettings,
  type AlertRuleKey,
  type AlertSettings,
} from '@/lib/alertSettings'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, alertSettings: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      enabled: canAccessFeature(user.plan, 'automatic_alerts'),
      plan: user.plan,
      settings: parseAlertSettings(user.alertSettings),
      rules: ALERT_RULES,
    })
  } catch (error) {
    console.error('Erro ao carregar alertSettings:', error)
    return NextResponse.json({ error: 'Erro ao carregar alertas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as Partial<AlertSettings> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const sanitized: Partial<AlertSettings> = {}
    for (const key of Object.keys(DEFAULT_ALERT_SETTINGS) as AlertRuleKey[]) {
      if (typeof body[key] === 'boolean') sanitized[key] = body[key]
    }

    const json = serializeAlertSettings(sanitized)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { alertSettings: json },
    })

    return NextResponse.json({
      success: true,
      settings: parseAlertSettings(json),
    })
  } catch (error) {
    console.error('Erro ao salvar alertSettings:', error)
    return NextResponse.json({ error: 'Erro ao salvar alertas' }, { status: 500 })
  }
}
