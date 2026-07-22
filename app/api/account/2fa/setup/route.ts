import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import QRCode from 'qrcode'
import { checkRateLimit, encryptSecret } from '@/lib/security-utils'
import { generateTotpSecret, buildOtpauthUri } from '@/lib/totp'
import { logAudit } from '@/lib/audit'

// Inicia a ativação do 2FA: gera um secret novo, guarda CIFRADO no banco com
// twoFactorEnabled=false (pendente) e devolve o QR Code + secret pro usuário
// escanear. A ativação só é concluída em /activate após confirmar um código.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`2fa:setup:${session.user.id}`, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, twoFactorEnabled: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'O 2FA já está ativo. Desative antes de gerar um novo.' },
        { status: 400 },
      )
    }

    const secret = generateTotpSecret()
    const otpauthUri = buildOtpauthUri({
      secretBase32: secret,
      accountName: user.email,
      issuer: 'FlowFunnel',
    })
    const qrDataUrl = await QRCode.toDataURL(otpauthUri)

    // Guarda o secret pendente (cifrado). Ainda NÃO habilita o 2FA.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: encryptSecret(secret) },
    })

    await logAudit({
      action: 'auth.2fa.setup_started',
      result: 'success',
      userId: session.user.id,
      entityType: 'User',
      entityId: session.user.id,
      request,
    })

    // O secret/otpauthUri são enviados AQUI (etapa de setup) propositalmente,
    // pra permitir o scan. Após a ativação eles nunca mais são devolvidos.
    return NextResponse.json({ secret, otpauthUri, qrDataUrl })
  } catch (error) {
    console.error('Erro ao iniciar 2FA:', error)
    return NextResponse.json({ error: 'Erro ao iniciar 2FA' }, { status: 500 })
  }
}
