/**
 * Lembrete de PIX gerado e não pago.
 *
 * Manda UM e-mail por cobrança, uma hora depois de o QR ser gerado, e só se o
 * pagamento continuar pendente no Mercado Pago.
 *
 * A varredura tem dois gatilhos, e ambos chamam a mesma função:
 *
 *  1. `maybeSweepInBackground()` — aproveita o tráfego que o site já tem. É o
 *     caminho padrão, porque a hospedagem atual não oferece agendador: o painel
 *     da Hostinger não expõe Cron Jobs para aplicação Node. Sem isto, o recurso
 *     dependeria de o dono cadastrar um serviço externo.
 *
 *  2. `sweepPixReminders()` direto, pela rota /api/cron/pix-reminder, para quem
 *     quiser um agendador de verdade depois. Os dois convivem sem conflito.
 *
 * O preço do gatilho por tráfego é a precisão: numa madrugada sem visitas o
 * aviso atrasa até alguém acessar. Para um lembrete de uma hora isso não muda
 * nada na prática — e a alternativa era o recurso não funcionar.
 */

import { prismaAdmin as prisma } from './prisma'
import { getPayment } from './mercadopago'
import { sendPixPendingEmail } from './email'
import { logAudit } from './audit'

// Começo da janela: o atraso pedido, tempo de a pessoa lembrar sozinha.
const ATRASO_MS = 60 * 60 * 1000
// Fim da janela: cobranças mais velhas já expiraram (a criação fixa 24h de
// validade), e um copia-e-cola morto é pior que nenhum e-mail. O corte também
// impede que uma pausa longa libere uma enxurrada de avisos atrasados.
const JANELA_MS = 24 * 60 * 60 * 1000
const LOTE = 50

export type ResultadoVarredura = {
  analisadas: number
  enviados: number
  jaResolvidas: number
  adiadas: number
}

export async function sweepPixReminders(): Promise<ResultadoVarredura> {
  const agora = Date.now()

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
  let jaResolvidas = 0
  let adiadas = 0

  for (const cobranca of pendentes) {
    let status: string | null = null
    try {
      const pagamento = await getPayment(Number(cobranca.paymentId))
      status = pagamento?.status ?? null
    } catch (e) {
      // Falha ao consultar (rede, limite de taxa): NÃO marca. Deixando para a
      // próxima passada, o pior caso é o aviso atrasar; marcar aqui perderia o
      // lembrete para sempre por um erro passageiro.
      adiadas++
      console.error(`[pix-reminder] falha ao consultar pagamento ${cobranca.paymentId}:`, e)
      continue
    }

    const aindaPendente = status === 'pending' || status === 'in_process'

    if (!aindaPendente) {
      // Pago, cancelado, recusado ou expirado — nada a lembrar. É esta consulta
      // que garante que ninguém receba cobrança de algo que acabou de pagar.
      await prisma.pixCharge.update({
        where: { id: cobranca.id },
        data: { remindedAt: new Date() },
      })
      jaResolvidas++
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

    // Reserva ANTES de enviar, condicionada a `remindedAt` ainda estar nulo.
    //
    // Com o gatilho por tráfego, duas requisições simultâneas podem varrer ao
    // mesmo tempo. Marcar depois do envio abriria a janela para as duas
    // mandarem o mesmo e-mail. Aqui só uma consegue a reserva — `count` volta 0
    // para a perdedora, que segue adiante sem enviar nada.
    const reserva = await prisma.pixCharge.updateMany({
      where: { id: cobranca.id, remindedAt: null },
      data: { remindedAt: new Date() },
    })
    if (reserva.count !== 1) continue

    try {
      await sendPixPendingEmail(
        email,
        cobranca.user?.name || '',
        cobranca.plan,
        cobranca.qrCode || '',
        cobranca.ticketUrl,
      )
    } catch (e) {
      // Envio falhou: devolve a reserva para a próxima passada tentar de novo,
      // enquanto a cobrança continuar dentro da janela.
      await prisma.pixCharge
        .update({ where: { id: cobranca.id }, data: { remindedAt: null } })
        .catch(() => {})
      adiadas++
      console.error(`[pix-reminder] falha ao enviar e-mail da cobrança ${cobranca.paymentId}:`, e)
      continue
    }

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

  return { analisadas: pendentes.length, enviados, jaResolvidas, adiadas }
}

// ── Gatilho por tráfego ──────────────────────────────────────────────────────

const INTERVALO_MS = 10 * 60 * 1000
let ultimaVarredura = 0
let varrendo = false

/**
 * Dispara a varredura no máximo uma vez a cada 10 minutos, sem bloquear quem
 * chamou. Não devolve nada de propósito: o resultado não interessa a quem
 * estava só carregando uma página.
 *
 * A trava é por processo. Com várias instâncias, cada uma pode varrer no mesmo
 * minuto — e tudo bem: quem garante o "um e-mail por cobrança" é a reserva
 * atômica lá em cima, não esta trava. Ela existe só para não consultar o banco
 * a cada requisição.
 */
export function maybeSweepInBackground(): void {
  const agora = Date.now()
  if (varrendo || agora - ultimaVarredura < INTERVALO_MS) return
  ultimaVarredura = agora
  varrendo = true

  sweepPixReminders()
    .then(r => {
      if (r.enviados > 0) {
        console.log(`[pix-reminder] ${r.enviados} lembrete(s) enviado(s)`)
      }
    })
    .catch(e => console.error('[pix-reminder] varredura falhou:', e))
    .finally(() => { varrendo = false })
}
