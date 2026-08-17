import { NextResponse } from 'next/server'
import { sweepPixReminders } from '@/lib/pix-reminder'

// Lembrete de PIX gerado e não pago — acionamento por agendador.
//
// A varredura NÃO depende desta rota: ela também roda sozinha, aproveitando o
// tráfego do site (ver `maybeSweepInBackground` em lib/pix-reminder.ts). Esse é
// o caminho padrão, porque o painel da Hostinger não expõe Cron Jobs para
// aplicação Node.
//
// Esta rota existe para quem quiser precisão de relógio em vez de depender de
// visitas: basta apontar um agendador externo para cá, a cada 15 minutos, com
// `Authorization: Bearer <CRON_SECRET>`. Os dois gatilhos convivem — a reserva
// atômica dentro da varredura impede que um e-mail saia duas vezes.
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

  try {
    const r = await sweepPixReminders()
    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    console.error('[pix-reminder] erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
