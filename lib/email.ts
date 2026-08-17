import { Resend } from 'resend'
import { TRIAL_DAYS } from './trial'

let resend: Resend | null = null

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'FlowSara <noreply@flowsara.com.br>'
const APP_URL = process.env.NEXTAUTH_URL || 'https://flowsara.com.br'

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
          '⚠️  Resend: domínio não verificado. Verifique flowsara.com.br em resend.com/domains.'
        )
        return { success: false, error: 'domain_not_verified' }
      }
      throw error
    }
    return { success: true, data }
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.name === 'validation_error') {
      console.warn('⚠️  Resend: domínio não verificado.')
      return { success: false, error: 'domain_not_verified' }
    }
    console.error('Erro ao enviar email:', err)
    return { success: false, error: err }
  }
}

// ─── Base template ────────────────────────────────────────────────────────────
function base({
  headerBg = 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
  headerEmoji,
  headerTitle,
  headerSubtitle,
  body,
  footerExtra = '',
}: {
  headerBg?: string
  headerEmoji: string
  headerTitle: string
  headerSubtitle?: string
  body: string
  footerExtra?: string
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headerTitle}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- HEADER -->
        <tr><td style="background:${headerBg};border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:20px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:40px;height:40px;border-radius:50%;overflow:hidden;background:#ffffff;vertical-align:middle;">
                  <img src="${APP_URL}/flowsara-logo.jpg" alt="FlowSara" width="40" height="40" style="display:block;border-radius:50%;object-fit:cover;" />
                </td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">FlowSara</span>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="border-top:1px solid rgba(255,255,255,0.2);padding-top:20px;">
              <div style="font-size:44px;margin-bottom:12px;">${headerEmoji}</div>
              <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px;line-height:1.2;">${headerTitle}</h1>
              ${headerSubtitle ? `<p style="color:rgba(255,255,255,0.8);font-size:15px;margin:0;">${headerSubtitle}</p>` : ''}
            </td></tr>
          </table>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#ffffff;padding:40px 40px 32px;">
          ${body}
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
          ${footerExtra ? `<p style="color:#64748b;font-size:13px;margin:0 0 12px;">${footerExtra}</p>` : ''}
          <p style="color:#94a3b8;font-size:12px;margin:0;">
            <strong style="color:#64748b;">FlowSara</strong> · Onde cada venda do seu funil é rastreada
          </p>
          <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0;">
            <a href="${APP_URL}" style="color:#94a3b8;text-decoration:none;">flowsara.com.br</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/billing" style="color:#94a3b8;text-decoration:none;">Gerenciar assinatura</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Botão primário ───────────────────────────────────────────────────────────
function btn(href: string, label: string, color = '#2563eb') {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:10px;background:${color};">
      <a href="${href}" target="_blank"
        style="display:inline-block;padding:15px 36px;color:#ffffff;font-size:16px;font-weight:700;
               text-decoration:none;border-radius:10px;letter-spacing:0.2px;">${label}</a>
    </td></tr>
  </table>`
}

// ─── Info box ─────────────────────────────────────────────────────────────────
function infoBox(content: string, bg = '#eff6ff', border = '#bfdbfe', textColor = '#1e40af') {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${bg};border:1px solid ${border};border-radius:12px;padding:20px 24px;color:${textColor};font-size:14px;line-height:1.8;">
      ${content}
    </td></tr>
  </table>`
}

// ─── Divider ─────────────────────────────────────────────────────────────────
const divider = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
</table>`

// ─── Plan labels & prices ─────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = { START: 'START', PRO: 'PRO', SCALE: 'SCALE' }
const PLAN_PRICES: Record<string, string> = { START: 'R$ 47,90', PRO: 'R$ 97,90', SCALE: 'R$ 147,90' }

// ══════════════════════════════════════════════════════════════════════════════
// 1. VERIFICAÇÃO DE EMAIL
// ══════════════════════════════════════════════════════════════════════════════
export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  return sendEmail(
    to,
    'Confirme seu email para acessar o FlowSara',
    base({
      headerEmoji: '✉️',
      headerTitle: 'Confirme seu email',
      headerSubtitle: 'Só mais um passo para liberar o seu acesso',
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">Olá, ${name || 'usuário'}!</h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
          Obrigado por se cadastrar no <strong>FlowSara</strong>. Para ativar sua conta e
          começar a rastrear cada etapa do seu funil de vendas, clique no botão abaixo para
          confirmar seu endereço de email.
        </p>

        <div style="text-align:center;margin:32px 0;">
          ${btn(verifyUrl, '✅  Confirmar meu email')}
        </div>

        ${infoBox(`
          <strong>🔒 Segurança:</strong><br/>
          Este link é válido por <strong>24 horas</strong>. Após esse prazo, você pode
          solicitar um novo link de verificação diretamente na plataforma.<br/><br/>
          Se você não criou uma conta no FlowSara, pode ignorar este email com segurança —
          nenhuma ação será tomada.
        `, '#f8fafc', '#e2e8f0', '#374151')}

        ${divider}

        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;text-align:center;">
          Problema com o botão? Copie e cole o link abaixo no navegador:<br/>
          <a href="${verifyUrl}" style="color:#2563eb;word-break:break-all;font-size:13px;">${verifyUrl}</a>
        </p>
      `,
      footerExtra: 'Sem cartão de crédito necessário · Acesso imediato após confirmação',
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. BEM-VINDO
// ══════════════════════════════════════════════════════════════════════════════
export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail(
    to,
    `Bem-vindo(a) ao FlowSara, ${name || 'usuário'}! 🎉`,
    base({
      headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 40%, #7c3aed 100%)',
      headerEmoji: '🎉',
      headerTitle: `Bem-vindo(a), ${name || 'usuário'}!`,
      headerSubtitle: 'Sua conta está pronta. Vamos começar!',
      body: `
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          É um prazer ter você no <strong>FlowSara</strong>! Agora você tem uma visão completa
          do seu funil de vendas — desde o primeiro clique no anúncio até o pagamento confirmado.
        </p>

        ${infoBox(`
          <strong style="display:block;margin-bottom:12px;font-size:15px;">🚀 Seus próximos passos:</strong>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;"><span style="color:#2563eb;font-weight:700;">1</span></td>
              <td style="padding:6px 0 6px 12px;color:#1e40af;">
                <strong>Conecte seu WhatsApp</strong> — automatize o acompanhamento de leads
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;"><span style="color:#2563eb;font-weight:700;">2</span></td>
              <td style="padding:6px 0 6px 12px;color:#1e40af;">
                <strong>Integre sua plataforma</strong> — Hotmart, Kiwify, Eduzz, Monetizze
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;"><span style="color:#2563eb;font-weight:700;">3</span></td>
              <td style="padding:6px 0 6px 12px;color:#1e40af;">
                <strong>Conecte seus anúncios</strong> — Facebook Ads, Google Ads, TikTok Ads
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;"><span style="color:#2563eb;font-weight:700;">4</span></td>
              <td style="padding:6px 0 6px 12px;color:#1e40af;">
                <strong>Veja seu funil em tempo real</strong> — descubra onde você está perdendo dinheiro
              </td>
            </tr>
          </table>
        `)}

        <div style="text-align:center;margin:32px 0;">
          ${btn(`${APP_URL}/dashboard`, '🚀  Acessar meu Dashboard')}
        </div>

        ${divider}

        <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0;text-align:center;">
          Ficou com dúvida? Responda este email ou acesse nossa central de ajuda.<br/>
          Estamos aqui para garantir que você aproveite ao máximo o FlowSara.
        </p>
      `,
      footerExtra: 'Boas vendas! A equipe FlowSara torce pelo seu sucesso.',
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. REDEFINIÇÃO DE SENHA
// ══════════════════════════════════════════════════════════════════════════════
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  return sendEmail(
    to,
    'Redefinição de senha — FlowSara',
    base({
      headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
      headerEmoji: '🔐',
      headerTitle: 'Redefinir sua senha',
      headerSubtitle: 'Recebemos uma solicitação para alterar sua senha',
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">Olá, ${name || 'usuário'}!</h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
          Você (ou alguém em seu nome) solicitou a redefinição da senha da sua conta no
          <strong>FlowSara</strong>. Clique no botão abaixo para criar uma nova senha com segurança.
        </p>

        <div style="text-align:center;margin:32px 0;">
          ${btn(resetUrl, '🔑  Redefinir minha senha')}
        </div>

        ${infoBox(`
          <strong>⏱️ Atenção:</strong> Este link expira em <strong>1 hora</strong>.<br/><br/>
          Se você <strong>não solicitou</strong> a redefinição de senha, ignore este email.
          Sua conta continua segura e a senha atual permanece a mesma.<br/><br/>
          Se receber este email com frequência sem ter solicitado, entre em contato com nosso suporte.
        `, '#fef2f2', '#fecaca', '#7f1d1d')}

        ${divider}

        <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;text-align:center;">
          Caso o botão não funcione, acesse a página de recuperação de senha no FlowSara
          e solicite um novo link de redefinição.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. CÓDIGO TROCA DE EMAIL
// ══════════════════════════════════════════════════════════════════════════════
export async function sendEmailChangeCode(to: string, name: string, code: string, pendingEmail: string) {
  return sendEmail(
    to,
    'Código de verificação para troca de email — FlowSara',
    base({
      headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
      headerEmoji: '🛡️',
      headerTitle: 'Verificação de segurança',
      headerSubtitle: 'Solicitação de troca de email detectada',
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">Olá, ${name || 'usuário'}!</h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 20px;">
          Foi solicitada a troca do email da sua conta no <strong>FlowSara</strong>.
          Para confirmar que você é o titular da conta, insira o código abaixo na tela onde
          a alteração foi solicitada.
        </p>

        ${infoBox(`
          <strong>Novo email solicitado:</strong><br/>
          <span style="font-size:16px;color:#1e40af;">${pendingEmail}</span>
        `, '#fef3c7', '#fbbf24', '#92400e')}

        <p style="color:#4b5563;font-size:15px;text-align:center;margin:24px 0 12px;font-weight:600;">
          Seu código de verificação:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td align="center">
            <div style="display:inline-block;background:#f1f5f9;border:2px dashed #94a3b8;border-radius:14px;padding:20px 40px;">
              <span style="font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:900;
                           color:#1e40af;letter-spacing:10px;display:block;">${code}</span>
            </div>
          </td></tr>
        </table>

        ${infoBox(`
          <strong>⏱️ Este código expira em 15 minutos</strong> e só pode ser usado uma vez.<br/><br/>
          Por segurança, o código é enviado sempre para o email <strong>atual</strong> da conta —
          nunca para o novo endereço.<br/><br/>
          Se você <strong>não solicitou</strong> esta troca, ignore este email. Sua conta e email
          atual permanecem inalterados.
        `, '#fef2f2', '#fca5a5', '#7f1d1d')}
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. CONVITE DE EQUIPE
// ══════════════════════════════════════════════════════════════════════════════
export async function sendTeamInviteEmail(to: string, inviterName: string, token: string) {
  const inviteUrl = `${APP_URL}/invite?token=${token}`
  return sendEmail(
    to,
    `${inviterName} te convidou para o FlowSara`,
    base({
      headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)',
      headerEmoji: '🤝',
      headerTitle: 'Você foi convidado!',
      headerSubtitle: `${inviterName} quer que você faça parte do time`,
      body: `
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          <strong>${inviterName}</strong> convidou você para acessar o painel do <strong>FlowSara</strong>
          — a plataforma que conecta WhatsApp, plataformas de venda e anúncios em um só lugar.
        </p>

        ${infoBox(`
          <strong style="display:block;margin-bottom:10px;">O que você poderá fazer:</strong>
          ✅ Acompanhar o funil de vendas em tempo real<br/>
          ✅ Monitorar leads e conversões do WhatsApp<br/>
          ✅ Ver métricas de campanhas e plataformas integradas<br/>
          ✅ Colaborar com o time no mesmo painel
        `)}

        <div style="text-align:center;margin:32px 0;">
          ${btn(inviteUrl, '✅  Aceitar convite', '#7c3aed')}
        </div>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;margin:0;">
          Este convite foi enviado por <strong>${inviterName}</strong>.<br/>
          Se você não esperava este convite, pode ignorar este email com segurança —
          nenhum acesso será criado sem que você clique no botão acima.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. NOTIFICAÇÃO DE VENDA
// ══════════════════════════════════════════════════════════════════════════════
export async function sendSaleNotificationEmail(to: string, name: string, plan: string, amount: number) {
  const amountStr = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  return sendEmail(
    to,
    `💰 Venda confirmada — R$ ${amountStr} | FlowSara`,
    base({
      headerBg: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
      headerEmoji: '💰',
      headerTitle: 'Nova venda confirmada!',
      headerSubtitle: 'Seu funil está convertendo. Parabéns!',
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 8px;">
          Parabéns, ${name || 'usuário'}! 🎉
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          Uma nova venda foi registrada e confirmada no seu funil do FlowSara.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr>
            <td style="background:#f0fdf4;border:1px solid #86efac;border-radius:14px;padding:28px;text-align:center;">
              <p style="color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-weight:600;">
                Valor recebido
              </p>
              <p style="color:#065f46;font-size:48px;font-weight:900;margin:0 0 8px;line-height:1;">
                R$ ${amountStr}
              </p>
              <p style="color:#059669;font-size:15px;font-weight:600;margin:0;">
                Plano ${plan} · Assinatura ativa ✅
              </p>
            </td>
          </tr>
        </table>

        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Acesse o painel para ver todos os detalhes desta venda, acompanhar a jornada
          completa do cliente no seu funil e conferir as métricas do dia.
        </p>

        <div style="text-align:center;margin:28px 0;">
          ${btn(`${APP_URL}/dashboard`, '📊  Ver no Dashboard', '#059669')}
        </div>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Continue monitorando seu funil para identificar o que mais converte.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. ALERTA DE LIMITE DE USO
// ══════════════════════════════════════════════════════════════════════════════
export async function sendUsageLimitWarningEmail(to: string, name: string, used: number, limit: number) {
  const percent = Math.round((used / limit) * 100)
  const isCritical = percent >= 90
  return sendEmail(
    to,
    `${isCritical ? '🚨' : '⚠️'} Você usou ${percent}% do limite de conversas — FlowSara`,
    base({
      headerBg: isCritical
        ? 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)'
        : 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
      headerEmoji: isCritical ? '🚨' : '⚠️',
      headerTitle: isCritical ? 'Limite quase esgotado!' : 'Atenção: limite de conversas',
      headerSubtitle: `Você usou ${percent}% das conversas disponíveis este mês`,
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Olá, ${name || 'usuário'}!
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          ${isCritical
            ? 'Você está prestes a atingir o limite de conversas do seu plano. Quando o limite for atingido, novos contatos poderão deixar de ser rastreados automaticamente.'
            : 'Você já utilizou uma parte significativa do limite de conversas do seu plano este mês. Acompanhe de perto para não ser pego de surpresa.'
          }
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr>
            <td style="background:${isCritical ? '#fef2f2' : '#fffbeb'};border:1px solid ${isCritical ? '#fca5a5' : '#fcd34d'};border-radius:14px;padding:24px;text-align:center;">
              <p style="color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;font-weight:600;">
                Conversas utilizadas em ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}
              </p>
              <p style="color:${isCritical ? '#7f1d1d' : '#78350f'};font-size:42px;font-weight:900;margin:0 0 4px;line-height:1;">
                ${used.toLocaleString('pt-BR')}
              </p>
              <p style="color:${isCritical ? '#dc2626' : '#d97706'};font-size:16px;font-weight:600;margin:0 0 12px;">
                de ${limit.toLocaleString('pt-BR')} disponíveis
              </p>
              <!-- Barra de progresso -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#e5e7eb;border-radius:999px;height:10px;">
                    <table width="${percent}%" cellpadding="0" cellspacing="0">
                      <tr><td style="background:${isCritical ? '#dc2626' : '#d97706'};border-radius:999px;height:10px;"></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="color:${isCritical ? '#dc2626' : '#d97706'};font-size:13px;font-weight:700;margin:8px 0 0;">${percent}% utilizado</p>
            </td>
          </tr>
        </table>

        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Faça upgrade agora para um plano com mais conversas e continue rastreando
          seus leads sem interrupção.
        </p>

        <div style="text-align:center;margin:28px 0;">
          ${btn(`${APP_URL}/checkout?plan=PRO`, '⚡  Fazer Upgrade agora', isCritical ? '#dc2626' : '#d97706')}
        </div>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          O contador é reiniciado todo mês. Acesse o
          <a href="${APP_URL}/dashboard" style="color:#2563eb;">painel</a>
          para ver o consumo detalhado.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. LEMBRETE CARTÃO (trial pendente)
// ══════════════════════════════════════════════════════════════════════════════
export async function sendTrialCardReminderEmail(to: string, name: string, plan: string) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const activateUrl = `${APP_URL}/activate-trial?plan=${plan}`
  return sendEmail(
    to,
    `⏳ Só falta um passo — ative seu teste grátis de ${TRIAL_DAYS} dias no FlowSara`,
    base({
      headerBg: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
      headerEmoji: '🎯',
      headerTitle: 'Seu teste grátis está esperando',
      headerSubtitle: `Plano ${planLabel} — ${TRIAL_DAYS} dias completamente grátis`,
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Olá, ${name || 'usuário'}!
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          Seu email foi confirmado! Falta apenas adicionar um cartão de crédito para
          ativar os <strong>${TRIAL_DAYS} dias grátis</strong> do plano <strong>${planLabel}</strong>.
          Não será feita nenhuma cobrança agora.
        </p>

        ${infoBox(`
          <strong style="display:block;margin-bottom:12px;">✅ O que está incluído no plano ${planLabel}:</strong>
          ✅ Nenhuma cobrança durante os ${TRIAL_DAYS} dias de teste<br/>
          ✅ Acesso completo a todos os recursos do plano ${planLabel}<br/>
          ✅ Integração com WhatsApp, Hotmart, Kiwify, Eduzz e mais<br/>
          ✅ Cancele a qualquer momento, sem multa e sem burocracia
        `)}

        <div style="text-align:center;margin:32px 0;">
          ${btn(activateUrl, '🚀  Ativar meu teste grátis', '#7c3aed')}
        </div>

        ${infoBox(`
          <strong>💳 Como funciona:</strong><br/>
          Você adiciona o cartão para garantir que não há bots — mas a cobrança de
          ${PLAN_PRICES[plan] ?? ''}/mês só acontece após os ${TRIAL_DAYS} dias, e somente se você
          não cancelar antes. Transparência total, sem surpresas.
        `, '#f0fdf4', '#86efac', '#065f46')}

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Dúvidas? Responda este email e nossa equipe te ajuda.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 8b. PIX GERADO E NÃO PAGO
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Enviado UMA vez, uma hora depois de o QR ser gerado, e só se a cobrança
 * ainda estiver pendente no Mercado Pago (o cron confere antes de enviar).
 *
 * Leva o copia-e-cola pronto porque é o caminho mais curto até o pagamento:
 * quem abandonou por distração resolve no próprio aplicativo do banco, sem
 * precisar voltar ao site e gerar tudo de novo.
 */
export async function sendPixPendingEmail(
  to: string,
  name: string,
  plan: string,
  qrCode: string,
  ticketUrl?: string | null,
) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const preco = PLAN_PRICES[plan] ?? ''
  return sendEmail(
    to,
    `Seu Pix do plano ${planLabel} ainda está aguardando pagamento`,
    base({
      headerBg: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
      headerEmoji: '⏱️',
      headerTitle: 'Seu Pix ainda não foi pago',
      headerSubtitle: `Plano ${planLabel}${preco ? ` — ${preco}/mês` : ''}`,
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Olá, ${name || 'tudo bem'}!
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          Você gerou um Pix para assinar o plano <strong>${planLabel}</strong> e ele
          ainda não foi pago. O código continua válido — é só copiar e colar no
          aplicativo do seu banco.
        </p>

        ${infoBox(`
          <strong style="display:block;margin-bottom:10px;">Pix copia e cola</strong>
          <span style="display:block;word-break:break-all;font-family:monospace;font-size:12px;
                       line-height:1.6;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;
                       padding:12px;color:#0f172a;">${qrCode}</span>
        `, '#f0fdfa', '#99f6e4', '#0f766e')}

        ${ticketUrl ? `
        <div style="text-align:center;margin:28px 0;">
          ${btn(ticketUrl, 'Abrir o Pix para pagar', '#0891b2')}
        </div>` : `
        <div style="text-align:center;margin:28px 0;">
          ${btn(`${APP_URL}/checkout?plan=${plan}`, 'Voltar ao checkout', '#0891b2')}
        </div>`}

        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 8px;">
          Assim que o pagamento cair, o acesso é liberado automaticamente — você
          não precisa avisar ninguém.
        </p>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Se você já pagou nos últimos minutos, pode ignorar este email.<br/>
          Se desistiu, não precisa fazer nada: o código expira sozinho.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. TRIAL ATIVADO
// ══════════════════════════════════════════════════════════════════════════════
export async function sendTrialActivatedEmail(to: string, name: string, plan: string, trialEndsAt: Date) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const endsStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(trialEndsAt)
  return sendEmail(
    to,
    `🚀 Teste grátis ativado! Plano ${planLabel} liberado por ${TRIAL_DAYS} dias — FlowSara`,
    base({
      headerBg: 'linear-gradient(135deg, #065f46 0%, #1e40af 100%)',
      headerEmoji: '🚀',
      headerTitle: 'Teste grátis ativado!',
      headerSubtitle: `Plano ${planLabel} liberado até ${endsStr}`,
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Bem-vindo(a) ao plano ${planLabel}, ${name || 'usuário'}!
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          Seu teste gratuito está ativo. Você tem acesso completo ao plano
          <strong>${planLabel}</strong> — explore tudo sem pressa durante os próximos ${TRIAL_DAYS} dias.
        </p>

        ${infoBox(`
          <strong style="display:block;margin-bottom:12px;">📅 Informações do seu teste:</strong>
          📆 <strong>Início:</strong> hoje<br/>
          📆 <strong>Término:</strong> ${endsStr}<br/>
          💳 <strong>Primeira cobrança:</strong> somente após ${endsStr}, se não cancelar<br/>
          💰 <strong>Valor:</strong> ${PLAN_PRICES[plan] ?? ''}/mês no FlowSara
        `, '#ecfdf5', '#6ee7b7', '#065f46')}

        ${infoBox(`
          <strong style="display:block;margin-bottom:10px;">🎯 Por onde começar:</strong>
          1️⃣ Conecte seu WhatsApp no painel<br/>
          2️⃣ Integre sua plataforma de vendas<br/>
          3️⃣ Configure o rastreamento dos seus anúncios<br/>
          4️⃣ Acompanhe seu funil em tempo real
        `)}

        <div style="text-align:center;margin:32px 0;">
          ${btn(`${APP_URL}/dashboard`, '📊  Acessar meu Dashboard', '#059669')}
        </div>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Quer cancelar antes do período terminar? Acesse
          <a href="${APP_URL}/billing" style="color:#2563eb;">Gerenciar assinatura</a>
          a qualquer momento, sem burocracia.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. TRIAL ENCERRANDO EM BREVE
// ══════════════════════════════════════════════════════════════════════════════
export async function sendTrialWillEndEmail(to: string, name: string, plan: string, trialEndsAt: Date, daysLeft: number) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  const endsStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(trialEndsAt)
  const isCritical = daysLeft <= 1
  const urgencyLabel = isCritical ? 'Último dia do seu teste!' : `${daysLeft} dias para o fim do teste`
  return sendEmail(
    to,
    `${isCritical ? '🚨' : '⏰'} ${urgencyLabel} — FlowSara Plano ${planLabel}`,
    base({
      headerBg: isCritical
        ? 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)'
        : 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
      headerEmoji: isCritical ? '🚨' : '⏰',
      headerTitle: urgencyLabel,
      headerSubtitle: `Seu teste encerra em ${endsStr}`,
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Olá, ${name || 'usuário'}!
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          ${isCritical
            ? `O seu teste gratuito do plano <strong>${planLabel}</strong> encerra <strong>hoje</strong>. Após a meia-noite de ${endsStr}, a assinatura começa automaticamente.`
            : `Faltam apenas <strong>${daysLeft} dias</strong> para o fim do seu teste gratuito do plano <strong>${planLabel}</strong>. Em ${endsStr} a assinatura é ativada automaticamente.`
          }
        </p>

        ${infoBox(`
          <strong>O que acontece depois do teste:</strong><br/><br/>
          💳 A assinatura de <strong>${PLAN_PRICES[plan] ?? ''}/mês no FlowSara</strong> começa em ${endsStr}<br/>
          ✅ Você mantém acesso a todos os recursos do plano ${planLabel}<br/>
          🔄 A cobrança é recorrente e pode ser cancelada a qualquer momento
        `, isCritical ? '#fef2f2' : '#fffbeb', isCritical ? '#fca5a5' : '#fcd34d', isCritical ? '#7f1d1d' : '#78350f')}

        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Se quiser continuar usando o FlowSara, não precisa fazer nada — a assinatura
          continua automaticamente. Se preferir cancelar, faça isso antes de ${endsStr}.
        </p>

        <div style="text-align:center;margin:28px 0;">
          ${btn(`${APP_URL}/dashboard`, '✅  Continuar usando o FlowSara', isCritical ? '#dc2626' : '#d97706')}
        </div>

        <p style="text-align:center;margin:16px 0 0;">
          <a href="${APP_URL}/billing"
            style="color:#6b7280;font-size:14px;text-decoration:underline;">
            Cancelar antes do término do teste
          </a>
        </p>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Dúvidas sobre o plano ou a cobrança? Responda este email — estamos aqui para ajudar.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. TRIAL CONVERTIDO (assinatura ativa)
// ══════════════════════════════════════════════════════════════════════════════
export async function sendTrialConvertedEmail(to: string, name: string, plan: string) {
  const planLabel = PLAN_LABELS[plan] ?? plan
  return sendEmail(
    to,
    `✅ Assinatura ativa no FlowSara — Plano ${planLabel}`,
    base({
      headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #059669 100%)',
      headerEmoji: '✅',
      headerTitle: `Assinatura ativa — Plano ${planLabel}`,
      headerSubtitle: 'Obrigado pela confiança no FlowSara!',
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Olá, ${name || 'usuário'}!
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          Seu teste gratuito foi convertido e sua assinatura do plano <strong>${planLabel}</strong>
          está oficialmente ativa no FlowSara. A primeira cobrança de <strong>${PLAN_PRICES[plan] ?? ''}/mês</strong>
          foi processada com sucesso.
        </p>

        ${infoBox(`
          <strong style="display:block;margin-bottom:12px;">📋 Detalhes da sua assinatura:</strong>
          📦 <strong>Plano:</strong> ${planLabel}<br/>
          💰 <strong>Valor:</strong> ${PLAN_PRICES[plan] ?? ''}/mês — cobrado no FlowSara<br/>
          🔄 <strong>Renovação:</strong> automática todo mês na mesma data<br/>
          ❌ <strong>Cancelamento:</strong> a qualquer momento sem multa
        `, '#ecfdf5', '#6ee7b7', '#065f46')}

        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Continue aproveitando o FlowSara ao máximo. Quanto mais integrações você
          configurar, mais visibilidade terá sobre o seu funil de vendas.
        </p>

        <div style="text-align:center;margin:28px 0;">
          ${btn(`${APP_URL}/dashboard`, '📊  Acessar meu Dashboard', '#059669')}
        </div>

        <p style="text-align:center;margin:16px 0 0;">
          <a href="${APP_URL}/billing"
            style="color:#6b7280;font-size:14px;text-decoration:underline;">
            Ver minha assinatura e histórico de pagamentos
          </a>
        </p>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Obrigado por escolher o FlowSara. A equipe está à disposição
          para garantir que você extraia o máximo da plataforma.
        </p>
      `,
    })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 12. META ATINGIDA
// ══════════════════════════════════════════════════════════════════════════════
export async function sendGoalCompletedEmail(
  userEmail: string,
  userName: string,
  goalTitle: string,
  targetValue: number,
  metric: string
) {
  const metricLabels: Record<string, string> = {
    sales: 'Vendas', revenue: 'Receita (R$)', leads: 'Leads',
    conversions: 'Conversões', clicks: 'Cliques',
  }
  const metricLabel = metricLabels[metric] || metric

  return sendEmail(
    userEmail,
    `🏆 Meta atingida: ${goalTitle} — FlowSara`,
    base({
      headerBg: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
      headerEmoji: '🏆',
      headerTitle: 'Meta atingida!',
      headerSubtitle: `Parabéns, ${userName}! Você chegou lá.`,
      body: `
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 16px;">
          Incrível, ${userName}! 🎉
        </h2>
        <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 24px;">
          Você atingiu a meta que definiu no FlowSara. Continue assim — cada meta
          atingida é um sinal de que seu funil está funcionando!
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr>
            <td style="background:linear-gradient(135deg, #f5f3ff, #ede9fe);border:1px solid #c4b5fd;border-radius:14px;padding:28px;text-align:center;">
              <p style="color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;font-weight:600;">
                Meta concluída
              </p>
              <h3 style="color:#4c1d95;font-size:22px;font-weight:800;margin:0 0 16px;">${goalTitle}</h3>
              <p style="color:#7c3aed;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;font-weight:600;">
                ${metricLabel}
              </p>
              <p style="color:#4c1d95;font-size:48px;font-weight:900;margin:0 0 8px;line-height:1;">
                ${targetValue.toLocaleString('pt-BR')}
              </p>
              <p style="color:#059669;font-size:16px;font-weight:700;margin:0;">✅ META ALCANÇADA!</p>
            </td>
          </tr>
        </table>

        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Que tal definir uma nova meta ainda maior? Acesse o painel para celebrar
          este resultado e configurar seu próximo objetivo.
        </p>

        <div style="text-align:center;margin:28px 0;">
          ${btn(`${APP_URL}/dashboard`, '🎯  Ver no Dashboard', '#7c3aed')}
        </div>

        ${divider}

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
          Continue acompanhando seu funil — o próximo nível está ao alcance.
        </p>
      `,
    })
  )
}
