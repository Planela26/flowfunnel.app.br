import { Resend } from 'resend'

let resend: Resend | null = null

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'FlowFunnel <noreply@flowfunnel.app.br>'
const APP_URL = process.env.NEXTAUTH_URL || 'https://flowfunnel.app.br'

async function sendEmail(to: string, subject: string, html: string) {
  const client = getResend()
  if (!client) {
    console.warn('⚠️  RESEND_API_KEY não configurada. Email não enviado:', subject)
    return { success: false, error: 'API key não configurada' }
  }
  try {
    const { data, error } = await client.emails.send({ from: FROM_EMAIL, to, subject, html })
    if (error) {
      const resendError = error as any
      if (resendError?.statusCode === 403 || resendError?.name === 'validation_error') {
        console.warn(
          '⚠️  Resend: domínio não verificado. Verifique flowfunnel.app.br em resend.com/domains para enviar e-mails a outros endereços.'
        )
        return { success: false, error: 'domain_not_verified' }
      }
      throw error
    }
    return { success: true, data }
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.name === 'validation_error') {
      console.warn(
        '⚠️  Resend: domínio não verificado. Verifique flowfunnel.app.br em resend.com/domains para enviar e-mails a outros endereços.'
      )
      return { success: false, error: 'domain_not_verified' }
    }
    console.error('Erro ao enviar email:', err)
    return { success: false, error: err }
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  return sendEmail(
    to,
    'Redefinir sua senha — FlowFunnel Funnel',
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: #1e40af; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🔐 FlowFunnel Funnel</h1>
      </div>
      <h2 style="color: #111827; margin-bottom: 8px;">Olá, ${name || 'usuário'}!</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Recebemos uma solicitação para redefinir a senha da sua conta.
        Clique no botão abaixo para criar uma nova senha.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}"
          style="background: #2563eb; color: white; text-decoration: none; padding: 14px 32px;
                 border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Redefinir minha senha
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6;">
        Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição,
        ignore este email — sua conta está segura.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #d1d5db; font-size: 12px; text-align: center;">FlowFunnel Funnel</p>
    </div>
    `
  )
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  return sendEmail(
    to,
    'Confirme seu email — FlowFunnel',
    `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <!-- Cabeçalho gradiente azul -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 35%, #1d4ed8 70%, #3b82f6 100%); text-align: center; padding: 40px 24px;">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #ffffff; flex-shrink: 0;">
            <img src="${APP_URL}/flowfunnel-logo.jpg" alt="FlowFunnel" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <span style="color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">FlowFunnel</span>
        </div>
        <p style="color: #93c5fd; font-size: 14px; margin-top: 8px; font-weight: 500;">
          WhatsApp · Facebook Ads · Hotmart · Kiwify · Eduzz · Monetizze
        </p>
      </div>

      <!-- Corpo do card -->
      <div style="padding: 40px 32px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #1e40af, #3b82f6); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            <span style="font-size: 28px;">✉️</span>
          </div>
          <h2 style="color: #111827; font-size: 24px; font-weight: 800; margin: 0;">Olá, ${name || 'usuário'}!</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; line-height: 1.7; text-align: center; margin-bottom: 28px;">
          Para finalizar seu cadastro e liberar o acesso completo ao FlowFunnel, confirme seu email clicando no botão abaixo.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}"
            style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; padding: 16px 40px;
                   border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;
                   box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
            Confirmar email →
          </a>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 28px 0;">
          <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
            🔒 <strong>Segurança:</strong> Este link expira em <strong>24 horas</strong>. Se você não criou uma conta no FlowFunnel, pode ignorar este email com segurança.
          </p>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          FlowFunnel · Descubra onde seu dinheiro está sendo perdido
        </p>
        <p style="color: #cbd5e1; font-size: 11px; margin-top: 4px;">
          Sem cartão de crédito · Acesso imediato · 7 dias de garantia
        </p>
      </div>
    </div>
    `
  )
}

export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail(
    to,
    'Bem-vindo ao FlowFunnel Funnel! 🎉',
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: #1e40af; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🎉 FlowFunnel Funnel</h1>
      </div>
      <h2 style="color: #111827;">Olá, ${name || 'usuário'}!</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Sua conta foi criada com sucesso! Agora você pode rastrear seu funil de vendas
        completo — do anúncio até o pagamento.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #374151; font-weight: 600;">Próximos passos:</p>
        <ol style="color: #6b7280; margin: 12px 0 0 0; padding-left: 20px; line-height: 2;">
          <li>Conecte seu WhatsApp</li>
          <li>Integre sua plataforma (Hotmart, Kiwify...)</li>
          <li>Veja seu funil em tempo real</li>
        </ol>
      </div>
      <div style="text-align: center;">
        <a href="${APP_URL}/dashboard"
          style="background: #2563eb; color: white; text-decoration: none; padding: 12px 28px;
                 border-radius: 8px; font-weight: 600; display: inline-block;">
          Acessar Dashboard →
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">Boas vendas! 🚀</p>
    </div>
    `
  )
}

export async function sendTeamInviteEmail(to: string, inviterName: string, token: string) {
  const inviteUrl = `${APP_URL}/invite?token=${token}`
  return sendEmail(
    to,
    `${inviterName} te convidou para o FlowFunnel Funnel`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: #1e40af; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🚀 FlowFunnel Funnel</h1>
      </div>
      <h2 style="color: #111827;">Você foi convidado!</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        <strong>${inviterName}</strong> te convidou para acessar o painel do FlowFunnel Funnel.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}"
          style="background: #2563eb; color: white; text-decoration: none; padding: 14px 32px;
                 border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Aceitar convite
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px;">
        Se você não esperava este convite, pode ignorar este email com segurança.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #d1d5db; font-size: 12px; text-align: center;">FlowFunnel Funnel</p>
    </div>
    `
  )
}

export async function sendSaleNotificationEmail(to: string, name: string, plan: string, amount: number) {
  return sendEmail(
    to,
    `💰 Nova venda confirmada — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: #16a34a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">💰 Venda Confirmada!</h1>
      </div>
      <h2 style="color: #111827;">Parabéns, ${name || 'usuário'}!</h2>
      <p style="color: #6b7280; line-height: 1.6;">Uma nova venda foi confirmada no seu funil.</p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="color: #166534; font-size: 32px; font-weight: 700; margin: 0;">
          R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p style="color: #15803d; margin: 8px 0 0; font-weight: 600;">Plano ${plan}</p>
      </div>
      <div style="text-align: center;">
        <a href="${APP_URL}/dashboard"
          style="background: #2563eb; color: white; text-decoration: none; padding: 12px 28px;
                 border-radius: 8px; font-weight: 600; display: inline-block;">
          Ver Dashboard →
        </a>
      </div>
    </div>
    `
  )
}

export async function sendUsageLimitWarningEmail(to: string, name: string, used: number, limit: number) {
  const percent = Math.round((used / limit) * 100)
  return sendEmail(
    to,
    `⚠️ Você está usando ${percent}% do limite de conversas`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: #d97706; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Limite de Conversas</h1>
      </div>
      <h2 style="color: #111827;">Atenção, ${name || 'usuário'}!</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Você já usou <strong>${percent}%</strong> do limite de conversas do seu plano este mês.
      </p>
      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="color: #92400e; font-size: 28px; font-weight: 700; margin: 0;">
          ${used.toLocaleString('pt-BR')} / ${limit.toLocaleString('pt-BR')}
        </p>
        <p style="color: #b45309; margin: 8px 0 0;">conversas utilizadas este mês</p>
      </div>
      <div style="text-align: center;">
        <a href="${APP_URL}/checkout?plan=PRO"
          style="background: #2563eb; color: white; text-decoration: none; padding: 12px 28px;
                 border-radius: 8px; font-weight: 600; display: inline-block;">
          Fazer Upgrade →
        </a>
      </div>
    </div>
    `
  )
}

const PLAN_PRICES: Record<string, string> = {
  START: 'R$ 97', PRO: 'R$ 147', SCALE: 'R$ 297',
}
const PLAN_LABELS: Record<string, string> = {
  START: 'START', PRO: 'PRO', SCALE: 'SCALE',
}

export async function sendTrialCardReminderEmail(to: string, name: string, plan: string) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const activateUrl = `${APP_URL}/activate-trial?plan=${plan}`
  return sendEmail(
    to,
    `🎯 Último passo: ative seu teste grátis de 7 dias do FlowFunnel ${planLabel}`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🎉 Email verificado!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">Você está a um passo do seu teste grátis</p>
      </div>
      <h2 style="color: #111827; margin-bottom: 8px;">Olá, ${name || 'usuário'}!</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Seu email foi confirmado. Agora adicione um cartão de crédito para ativar
        <strong>7 dias grátis</strong> do plano <strong>${planLabel}</strong>.
      </p>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <ul style="list-style: none; padding: 0; margin: 0; color: #1e40af; font-size: 14px; line-height: 1.8;">
          <li>✅ Nenhuma cobrança durante os 7 dias</li>
          <li>✅ Cancele a qualquer momento</li>
          <li>✅ Acesso completo ao plano ${planLabel}</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${activateUrl}"
          style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none;
                 padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">
          Ativar meu teste grátis →
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; text-align: center; line-height: 1.6;">
        Após os 7 dias, a assinatura é cobrada automaticamente por ${PLAN_PRICES[plan] ?? ''}/mês.
        Você pode cancelar antes do término sem custo algum.
      </p>
    </div>
    `
  )
}

export async function sendTrialActivatedEmail(to: string, name: string, plan: string, trialEndsAt: Date) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const endsStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(trialEndsAt)
  return sendEmail(
    to,
    `🚀 Seu teste grátis de 7 dias começou — Plano ${planLabel}`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: linear-gradient(135deg, #059669 0%, #1e40af 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🚀 Teste ativado!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Plano ${planLabel} — 7 dias grátis</p>
      </div>
      <h2 style="color: #111827;">Bem-vindo(a), ${name || 'usuário'}!</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        Seu teste gratuito está ativo. Você tem acesso completo ao plano <strong>${planLabel}</strong>
        até <strong>${endsStr}</strong>.
      </p>
      <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #065f46; font-weight: 600;">📅 Seu teste termina em: ${endsStr}</p>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">
          Após essa data, a assinatura de ${PLAN_PRICES[plan] ?? ''}/mês é cobrada automaticamente.
        </p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}/dashboard"
          style="background: #059669; color: white; text-decoration: none; padding: 14px 32px;
                 border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Acessar o dashboard
        </a>
      </div>
    </div>
    `
  )
}

export async function sendTrialWillEndEmail(to: string, name: string, plan: string, trialEndsAt: Date, daysLeft: number) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const endsStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(trialEndsAt)
  const urgency = daysLeft <= 1 ? '⚠️ Último dia!' : `⏰ ${daysLeft} dias restantes`
  return sendEmail(
    to,
    `${urgency} — Seu teste grátis do FlowFunnel termina em breve`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: ${daysLeft <= 1 ? '#dc2626' : '#d97706'}; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${urgency}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Seu teste expira em ${endsStr}</p>
      </div>
      <p style="color: #6b7280; line-height: 1.6;">
        Olá, ${name || 'usuário'}! Seu teste gratuito do plano <strong>${planLabel}</strong>
        termina em <strong>${daysLeft <= 1 ? 'menos de 24 horas' : `${daysLeft} dias`}</strong>.
      </p>
      <p style="color: #6b7280; line-height: 1.6;">
        Após essa data, sua assinatura de <strong>${PLAN_PRICES[plan] ?? ''}/mês</strong> começa automaticamente.
        Se preferir, cancele antes que o período de teste termine.
      </p>
      <div style="text-align: center; margin: 32px 0; display: flex; flex-direction: column; gap: 12px; align-items: center;">
        <a href="${APP_URL}/dashboard"
          style="background: #2563eb; color: white; text-decoration: none; padding: 12px 28px;
                 border-radius: 8px; font-weight: 600; display: inline-block; margin-bottom: 12px;">
          Continuar usando o FlowFunnel
        </a>
        <a href="${APP_URL}/billing"
          style="color: #6b7280; font-size: 13px; text-decoration: underline;">
          Gerenciar assinatura / Cancelar
        </a>
      </div>
    </div>
    `
  )
}

export async function sendTrialConvertedEmail(to: string, name: string, plan: string) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  return sendEmail(
    to,
    `✅ Assinatura ativa — Plano ${planLabel} FlowFunnel`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: #1e40af; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">✅ Assinatura ativa!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Plano ${planLabel} — obrigado pela confiança</p>
      </div>
      <p style="color: #6b7280; line-height: 1.6;">
        Olá, ${name || 'usuário'}! Seu período de teste terminou e sua assinatura do
        plano <strong>${planLabel}</strong> (${PLAN_PRICES[plan] ?? ''}/mês) está ativa.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}/billing"
          style="background: #2563eb; color: white; text-decoration: none; padding: 12px 28px;
                 border-radius: 8px; font-weight: 600; display: inline-block;">
          Ver minha assinatura
        </a>
      </div>
    </div>
    `
  )
}

export async function sendGoalCompletedEmail(
  userEmail: string,
  userName: string,
  goalTitle: string,
  targetValue: number,
  metric: string
) {
  const metricLabels: Record<string, string> = {
    sales: 'Vendas', revenue: 'Receita', leads: 'Leads',
    conversions: 'Conversões', clicks: 'Cliques',
  }
  const metricLabel = metricLabels[metric] || metric

  return sendEmail(
    userEmail,
    `🎉 Meta Atingida: ${goalTitle}`,
    `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🎉 Parabéns, ${userName}!</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Você atingiu sua meta!</p>
      </div>
      <h2 style="color: #111827;">${goalTitle}</h2>
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #6b7280;">Meta de ${metricLabel}</p>
        <p style="color: #10b981; font-size: 32px; font-weight: 700; margin: 8px 0;">
          ${targetValue.toLocaleString('pt-BR')}
        </p>
        <p style="margin: 0; color: #10b981; font-weight: 600;">✅ META ALCANÇADA!</p>
      </div>
      <div style="text-align: center;">
        <a href="${APP_URL}/dashboard"
          style="background: #667eea; color: white; text-decoration: none; padding: 12px 28px;
                 border-radius: 8px; font-weight: 600; display: inline-block;">
          Ver Dashboard
        </a>
      </div>
    </div>
    `
  )
}
