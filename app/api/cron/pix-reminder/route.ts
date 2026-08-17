import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { getPayment } from '@/lib/mercadopago'
import { sendPixPendingEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'

// Lembrete de PIX gerado e não pago.
//
// Manda UM e-mail por cobrança, uma hora depois de o QR ser gerado, e só se o
// pagamento continuar pendente. Disparo esperado: a cada 15 minutos, via Cron
// Job apontando para esta URL com `Authorization: Bearer <CRON_SECRET>`.
//
// A janela tem começo e fim de propósito:
//   - começo em 1h — é o atraso pedido, tempo de a pessoa lembrar sozinha;
//   - fim em 24h — cobranças mais velhas que isso já expiraram (a criação fixa
//     24h de validade), e mandar um copia-e-cola morto é pior que não mandar.
//     O corte também impede que uma pausa longa do agendador libere uma
//     enxurrada de e-mails atrasados sobre cobranças que já não valem.
const ATRASO_MS = 60 * 60 * 1000
const JANELA_MS = 24 * 60 * 60 * 1000
const LOTE = 100

export async function POST(request: Request) {
  return run(request)
}

export async function GET(request: Request) {
  return run(request)
}

async function run(request: Request) {
  // Fail-closed, ao contrário do cron de snapshot: esta rota DISPARA E-MAILS.
  // Sem segredo configurado ela vira um botão público de envio em massa, então
  // a ausência da variável recusa em vez de liberar.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('🚫 CRON_SECRET não configurado — pix-reminder recusado (fail-closed)')
    return NextResponse.json({ error: 'Não configurado' }, { status: 503 })
  }
  const headerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = Date.now()

  try {
    const pendentes = await prisma.pixCharge.findMany({
      where: {
        remindedAt: null,
        createdAt: {
          lte: new Date(agora - ATRASO_MS),
          gte: new Date(agora - JANELA_MS),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: LOTE,
      include: { user: { select: { email: true, name: true } } },
    })

    let enviados = 0
    let jaPagos = 0
    let semRetorno = 0

    for (const cobranca of pendentes) {
      let status: string | null = null
      try {
        const pagamento = await getPayment(Number(cobranca.paymentId))
        status = pagamento?.status ?? null
      } catch (e) {
        // Falha ao consultar (rede, limite de taxa): NÃO marca como avisada.
        // Deixando para a próxima passada, o pior caso é o lembrete atrasar;
        // marcar aqui perderia o aviso para sempre por um erro passageiro.
        semRetorno++
        console.error(`[pix-reminder] falha ao consultar pagamento ${cobranca.paymentId}:`, e)
        continue
      }

      const aindaPendente = status === 'pending' || status === 'in_process'

      if (!aindaPendente) {
        // Pago, cancelado, recusado ou expirado — nada a lembrar. Marca para
        // sair da varredura. É esta consulta que garante que ninguém receba
        // cobrança de algo que acabou de pagar.
        await prisma.pixCharge.update({
          where: { id: cobranca.id },
          data: { remindedAt: new Date() },
        })
        jaPagos++
        continue
      }

      const email = cobranca.user?.email
      if (!email) {
        await prisma.pixCharge.update({
          where: { id: cobranca.id },
          data: { remindedAt: new Date() },
        })
        continue
      }

      try {
        await sendPixPendingEmail(
          email,
          cobranca.user?.name || '',
          cobranca.plan,
          cobranca.qrCode || '',
          cobranca.ticketUrl,
        )
      } catch (e) {
        // Falha de envio também não marca — tenta de novo na próxima passada,
        // enquanto a cobrança estiver dentro da janela de 24h.
        semRetorno++
        console.error(`[pix-reminder] falha ao enviar e-mail da cobrança ${cobranca.paymentId}:`, e)
        continue
      }

      // Marcar SÓ depois do envio bem-sucedido é o que torna o "um e-mail por
      // cobrança" verdadeiro sem arriscar o silêncio total.
      await prisma.pixCharge.update({
        where: { id: cobranca.id },
        data: { remindedAt: new Date() },
      })
      enviados++

      await logAudit({
        action: 'billing.pix_reminder_sent',
        result: 'success',
        userId: cobranca.userId,
        entityType: 'PixCharge',
        entityId: cobranca.id,
        metadata: { paymentId: cobranca.paymentId, plan: cobranca.plan },
      })
    }

    return NextResponse.json({
      ok: true,
      analisadas: pendentes.length,
      enviados,
      jaResolvidas: jaPagos,
      adiadas: semRetorno,
    })
  } catch (error) {
    console.error('[pix-reminder] erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
