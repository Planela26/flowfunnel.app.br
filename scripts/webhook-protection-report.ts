/**
 * Relatório de proteção de webhooks.
 *
 * Mostra, para cada integração de plataforma de pagamento:
 *  - se a rota opera em modo fail-closed (HMAC obrigatório)
 *  - se o segredo (*_WEBHOOK_SECRET) está configurado no ambiente
 *  - o status efetivo de proteção
 *
 * Uso: npx tsx scripts/webhook-protection-report.ts
 * Gera/atualiza WEBHOOK_SECURITY_REPORT.md e imprime a tabela no console.
 */
import fs from 'fs'
import path from 'path'

type Row = {
  integration: string
  envVar: string
  failClosed: boolean // rota exige HMAC (requireSecret=true) OU outro mecanismo fail-closed
  mechanism: string
  secretConfigured: boolean
}

const rows: Row[] = [
  {
    integration: 'Eduzz',
    envVar: 'EDUZZ_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'HMAC obrigatório (requireSecret)',
    secretConfigured: !!process.env.EDUZZ_WEBHOOK_SECRET,
  },
  {
    integration: 'Kiwify',
    envVar: 'KIWIFY_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'HMAC obrigatório (requireSecret)',
    secretConfigured: !!process.env.KIWIFY_WEBHOOK_SECRET,
  },
  {
    integration: 'Monetizze',
    envVar: 'MONETIZZE_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'HMAC obrigatório (requireSecret)',
    secretConfigured: !!process.env.MONETIZZE_WEBHOOK_SECRET,
  },
  {
    integration: 'Perfect Pay',
    envVar: 'PERFECT_PAY_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'HMAC obrigatório (requireSecret)',
    secretConfigured: !!process.env.PERFECT_PAY_WEBHOOK_SECRET,
  },
  {
    integration: 'Stripe',
    envVar: 'STRIPE_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'HMAC obrigatório (verificação nativa Stripe)',
    secretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
  },
  {
    integration: 'Mercado Pago',
    envVar: 'MERCADOPAGO_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'HMAC obrigatório (x-signature)',
    secretConfigured: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
  },
  {
    integration: 'Hotmart',
    envVar: 'HOTMART_WEBHOOK_SECRET',
    failClosed: true,
    mechanism: 'Hottok obrigatório por tenant (403 se ausente) + HMAC opcional',
    secretConfigured: !!process.env.HOTMART_WEBHOOK_SECRET,
  },
]

function effectiveStatus(r: Row): { label: string; active: boolean } {
  // Hotmart é fail-closed pelo hottok mesmo sem secret HMAC.
  if (r.integration === 'Hotmart') {
    return { label: 'PROTEGIDO (hottok por tenant)', active: true }
  }
  if (r.secretConfigured) return { label: 'PROTEGIDO', active: true }
  // fail-closed + secret ausente = a rota REJEITA tudo (503). Seguro, mas inoperante.
  return { label: 'BLOQUEADO (fail-closed, segredo ausente)', active: false }
}

function main() {
  console.log('\n=== RELATÓRIO DE PROTEÇÃO DE WEBHOOKS ===\n')
  const header = `${'Integração'.padEnd(14)} ${'Fail-closed'.padEnd(12)} ${'Segredo'.padEnd(10)} Status`
  console.log(header)
  console.log('-'.repeat(header.length + 20))

  for (const r of rows) {
    const st = effectiveStatus(r)
    console.log(
      `${r.integration.padEnd(14)} ${(r.failClosed ? 'SIM' : 'não').padEnd(12)} ${(r.secretConfigured ? 'set' : 'AUSENTE').padEnd(10)} ${st.label}`,
    )
  }

  const protectedCount = rows.filter((r) => effectiveStatus(r).active).length
  const blocked = rows.filter((r) => !effectiveStatus(r).active)
  console.log(`\n${protectedCount}/${rows.length} integrações com proteção ATIVA.`)
  if (blocked.length > 0) {
    console.log(
      `⚠️  ${blocked.length} bloqueada(s) por segredo ausente (fail-closed rejeita até configurar): ` +
        blocked.map((r) => r.envVar).join(', '),
    )
  }

  // Markdown
  const now = new Date().toISOString().slice(0, 10)
  const md = [
    '# Relatório de Proteção de Webhooks — FlowFunnel',
    '',
    `**Gerado em:** ${now}`,
    '',
    'Mostra o status de proteção de cada webhook de plataforma de pagamento após',
    'a correção do finding F2 (HMAC obrigatório / fail-closed).',
    '',
    '| Integração | Fail-closed | Mecanismo | Segredo configurado | Status efetivo |',
    '|---|---|---|---|---|',
    ...rows.map((r) => {
      const st = effectiveStatus(r)
      return `| ${r.integration} | ${r.failClosed ? '✅ Sim' : '❌ Não'} | ${r.mechanism} | ${r.secretConfigured ? '✅ Sim' : '⚠️ Ausente'} | ${st.active ? '🟢 ' + st.label : '🔴 ' + st.label} |`
    }),
    '',
    `**Resumo:** ${protectedCount}/${rows.length} integrações com proteção ativa.`,
    '',
    '## Como funciona o fail-closed',
    '',
    'As rotas de Eduzz, Kiwify, Monetizze e Perfect Pay (URL legada e tokenizada)',
    'agora chamam `guardWebhook({ ..., requireSecret: true })`. Quando o segredo',
    '`*_WEBHOOK_SECRET` correspondente **não está configurado**, a rota:',
    '',
    '1. **NÃO processa** o webhook;',
    '2. **registra um alerta** no log (`🚨 [webhook-security] ALERTA ...`);',
    '3. **retorna HTTP 503** (`Webhook secret not configured`).',
    '',
    'Quando o segredo está configurado, a **assinatura HMAC é obrigatória** em 100%',
    'das requisições: assinatura ausente ou inválida → **HTTP 403**.',
    '',
    'Hotmart usa o **hottok por tenant** como autenticação primária (403 quando',
    'ausente), com HMAC opcional — portanto também é fail-closed na identificação',
    'do tenant.',
    '',
    '## Ação pendente',
    '',
    blocked.length === 0
      ? '- Nenhuma. Todas as integrações em uso têm proteção ativa.'
      : `- Configurar os segredos das integrações que serão usadas: ${blocked
          .map((r) => '`' + r.envVar + '`')
          .join(', ')}. Enquanto ausentes, essas rotas rejeitam **todas** as chamadas (fail-closed seguro).`,
    '',
  ].join('\n')

  const out = path.join(process.cwd(), 'WEBHOOK_SECURITY_REPORT.md')
  fs.writeFileSync(out, md)
  console.log(`\n📄 Relatório escrito em ${out}`)
}

main()
