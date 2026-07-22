# Relatório de Proteção de Webhooks — FlowFunnel

**Gerado em:** 2026-06-07

Mostra o status de proteção de cada webhook de plataforma de pagamento após
a correção do finding F2 (HMAC obrigatório / fail-closed).

| Integração | Fail-closed | Mecanismo | Segredo configurado | Status efetivo |
|---|---|---|---|---|
| Eduzz | ✅ Sim | HMAC obrigatório (requireSecret) | ⚠️ Ausente | 🔴 BLOQUEADO (fail-closed, segredo ausente) |
| Kiwify | ✅ Sim | HMAC obrigatório (requireSecret) | ⚠️ Ausente | 🔴 BLOQUEADO (fail-closed, segredo ausente) |
| Monetizze | ✅ Sim | HMAC obrigatório (requireSecret) | ⚠️ Ausente | 🔴 BLOQUEADO (fail-closed, segredo ausente) |
| Perfect Pay | ✅ Sim | HMAC obrigatório (requireSecret) | ⚠️ Ausente | 🔴 BLOQUEADO (fail-closed, segredo ausente) |
| Stripe | ✅ Sim | HMAC obrigatório (verificação nativa Stripe) | ✅ Sim | 🟢 PROTEGIDO |
| Mercado Pago | ✅ Sim | HMAC obrigatório (x-signature) | ✅ Sim | 🟢 PROTEGIDO |
| Hotmart | ✅ Sim | Hottok obrigatório por tenant (403 se ausente) + HMAC opcional | ⚠️ Ausente | 🟢 PROTEGIDO (hottok por tenant) |

**Resumo:** 3/7 integrações com proteção ativa.

## Como funciona o fail-closed

As rotas de Eduzz, Kiwify, Monetizze e Perfect Pay (URL legada e tokenizada)
agora chamam `guardWebhook({ ..., requireSecret: true })`. Quando o segredo
`*_WEBHOOK_SECRET` correspondente **não está configurado**, a rota:

1. **NÃO processa** o webhook;
2. **registra um alerta** no log (`🚨 [webhook-security] ALERTA ...`);
3. **retorna HTTP 503** (`Webhook secret not configured`).

Quando o segredo está configurado, a **assinatura HMAC é obrigatória** em 100%
das requisições: assinatura ausente ou inválida → **HTTP 403**.

Hotmart usa o **hottok por tenant** como autenticação primária (403 quando
ausente), com HMAC opcional — portanto também é fail-closed na identificação
do tenant.

## Ação pendente

- Configurar os segredos das integrações que serão usadas: `EDUZZ_WEBHOOK_SECRET`, `KIWIFY_WEBHOOK_SECRET`, `MONETIZZE_WEBHOOK_SECRET`, `PERFECT_PAY_WEBHOOK_SECRET`. Enquanto ausentes, essas rotas rejeitam **todas** as chamadas (fail-closed seguro).
