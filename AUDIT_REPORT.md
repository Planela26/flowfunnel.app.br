# Relatório de Auditoria Funcional — FlowFunnel SaaS

**Data:** 07 de junho de 2026
**Escopo:** Auditoria pré-lançamento com **testes reais executados** (não apenas
análise estática) cobrindo autenticação, pagamentos/assinaturas, cálculos de
métricas, funis, IA, integrações (Meta/WhatsApp/plataformas), e-mail,
multi-tenant, conectividade e segurança.

---

## 1. Nota de Prontidão: **91 / 100** — APTO PARA LANÇAR com 1 ajuste de config

A base está sólida e madura: isolamento multi-tenant por RLS no banco, fluxos de
pagamento endurecidos, deduplicação de vendas, webhooks *fail-closed* e todos os
cálculos financeiros corretos. A nota não é 100 por causa de **1 item de
configuração** (segredos de webhook de algumas plataformas) e **1 bug de métrica**
no painel admin. Nenhum é bloqueador crítico de funcionamento.

> **Nota de método:** marco claramente o que foi **comprovado por teste automático**
> (✅) e o que foi **verificado por leitura de código/configuração** (🔎). Findings
> só são afirmados como fato quando há evidência objetiva.

---

## 2. Metodologia e resultados (147 verificações automáticas, 147 aprovadas)

| Suíte | Arquivo | Tipo | Resultado |
|---|---|---|---|
| Métricas (ROI/ROAS/CTR/CPC/CPM/conversão/auditoria) | `__tests__/metrics.test.ts` | Unitário | **20/20 ✅** |
| 2FA / TOTP | `__tests__/totp.test.ts` | Unitário | **21/21 ✅** |
| RLS multi-tenant | `__tests__/rls.test.ts` | Integração DB | **17/17 ✅** |
| Cálculos puros (planos/trial/lead scoring/estágios/vendas/senha) | `__tests__/calculations.test.ts` | Unitário | **63/63 ✅** |
| Integração ao vivo (endpoints reais na porta 5000) | `__tests__/integration.live.ts` | E2E HTTP | **20/20 ✅** |
| Conectividade + auditoria de config | `scripts/connectivity-check.ts` | Rede/Config | **6/6 ✅** |

Os testes E2E semearam tenants reais via `prismaAdmin`, autenticaram com cookie JWT
NextAuth legítimo, bateram nos endpoints HTTP em execução e **leram o banco para
confirmar a persistência** (ex.: hash de senha). Os dados foram limpos ao final.

---

## 3. Funcionalidades TESTADAS e APROVADAS ✅

### Autenticação & Contas (E2E real)
- ✅ Registro real via endpoint cria usuário no banco; **a senha é persistida como
  hash bcrypt `$2*`** (não em texto puro) e confere com a original — provado lendo o
  registro no DB após o POST.
- ✅ Senha fraca rejeitada com **HTTP 400**; **e-mail duplicado** rejeitado com 400
  (unicidade real).
- ✅ Rota autenticada sem sessão retorna **401**.
- ✅ 2FA/TOTP: geração, verificação, janela de tempo, códigos de recuperação.

### Pagamentos & Assinaturas
- ✅ **Stripe LIVE** conectado (`balance.retrieve` → `livemode=true`).
- ✅ Webhook Stripe **fail-closed**: sem `stripe-signature` → **400**.
- ✅ Webhook Mercado Pago **fail-closed**: sem `x-signature` → **401**.
- ✅ Mercado Pago autentica (`/v1/payment_methods` → HTTP 200).
- 🔎 Stripe e Mercado Pago **com segredo de webhook configurado** (verificado na
  auditoria de config).
- ✅ Deduplicação de vendas por `transactionId` + exclusão de reembolso, comprovada
  via `/api/reports` (4 eventos → 2 vendas, R$ 494).
- 🔎 Checkout/portal/trial/renovação/downgrade conferidos por código (não executados
  para não gerar cobrança real).

### Cálculos (todos conferidos por teste)
- ✅ ROI `((rev/cost)-1)*100`, ROAS, CTR, CPC, CPM, conversão, distribuição por
  cliques, auditoria de soma de fontes.
- ✅ Consumo de uso (`used`/`limit`/`remaining`/`percent`) via `/api/usage`.
- ✅ Lead scoring (PRO+): score 0–100, quente/morno/frio, sinais, soma de gasto.
- 🔎 Tendências (`/api/analytics/trends`): classificação ±5%, comparação só de
  períodos completos, quedas consecutivas — lógica conferida no código (endpoint é
  *gated* para SCALE).

### Multi-tenant
- ✅ Isolamento ao vivo via HTTP: tenant A **não** vê receita do tenant B
  (R$ 494 vs R$ 5.000 isolados); A vê 5 conversas, B vê 0.
- ✅ RLS no PostgreSQL (17 testes): próprio tenant OK, cross-tenant negado, sem
  contexto = 0 linhas, User self-only, admin bypass.

### Integrações de plataforma
- ✅ Mapeamento de status (paid→Pago, refused→Recusado, refunded→Reembolsado,
  chargeback→Chargeback, abandoned→Abandonado, checkout→Checkout, desconhecido→null).

### E-mail & IA
- ✅ Resend autentica e **domínio `flowfunnel` está VERIFICADO** (`status=verified`)
  — e-mails transacionais serão entregues a clientes reais.
- ✅ OpenAI autentica (`/v1/models` → 200) — IA operante (não em modo demo).

### Infra
- ✅ PostgreSQL responde (`SELECT 1`).

---

## 4. Não testável por execução real (por design / segurança)

| Item | Por quê | Situação |
|---|---|---|
| Cobrança real de cartão / assinatura | Não cobrar cartões reais | Fluxo conferido no código |
| Entrega real de e-mail a terceiros | Não disparar e-mails reais em teste | Credencial + domínio verificados (entrega habilitada) |
| **Envio** de mensagens WhatsApp | **O produto NÃO envia** — só rastreia/qualifica (escopo) | N/A — correto |
| Sincronização Meta/Facebook Ads | Requer conta de anúncios real | Ingestão de custo conferida no código |

---

## 5. Bugs e Riscos

### 🟠 F1 — Churn Rate infla (MÉDIO) — bug de cálculo ✅ comprovado por código
**Arquivo:** `app/api/admin/churn-metrics/route.ts` (linhas 44–49). Conta **todo**
usuário FREE como "cancelado", inclusive quem **nunca pagou**:
```js
const churnedUsers = users.filter(u => u.plan === 'FREE')   // ← conta todo FREE
const churnRate = (churnedUsers.length / users.length) * 100
```
**Impacto:** churn do painel admin fica sistematicamente inflado. Métrica **interna**
(só ADMIN); não afeta clientes nem cobrança. **Correção:** considerar churn apenas
quem teve assinatura (`stripeSubscriptionId`) e hoje está FREE, ou medir por janela
(cancelados nos últimos 30d ÷ pagantes no início do período).

### ✅ F2 — Webhooks de plataforma sem segredo (MÉDIO-ALTO) — **CORRIGIDO**
**Antes:** a lógica só **exigia** HMAC quando o segredo existia; sem ele, o webhook
aceitava payloads **não assinados** (fail-open). Auditoria confirmou os 4 segredos
ausentes.
**Correção aplicada:** `guardWebhook` ganhou o modo **fail-closed** (`requireSecret:
true`), agora ativo nas 8 rotas (Eduzz/Kiwify/Monetizze/Perfect Pay, URL legada +
tokenizada). Sem o `*_WEBHOOK_SECRET`: **não processa**, **loga alerta** e retorna
**HTTP 503**. Com o segredo: **HMAC obrigatório** (ausente/inválido → 403).
**Comprovação:** teste `__tests__/webhook-failclosed.test.ts` (9/9) + teste ao vivo
(POST nas 4 rotas → 503) + relatório `WEBHOOK_SECURITY_REPORT.md`.
**Pendência operacional (não é bug):** enquanto os segredos não forem configurados,
essas rotas rejeitam **tudo** (fail-closed seguro). Configure os
`*_WEBHOOK_SECRET` das plataformas que o cliente realmente usar para ativá-las.

### 🟢 F4 — Fallback `'demo-mode'` na chave OpenAI (BAIXO) — robustez
`app/api/ai/suggestions/route.ts` usa `process.env.OPENAI_API_KEY || 'demo-mode'`.
A chave **está configurada** (IA funcionando), mas o fallback silencioso poderia
mascarar uma chave ausente em produção. **Sugestão:** logar/alertar nesse caso.

### 🟢 F5 — `replit.md` muito extenso (INFORMATIVO)
README grande e difícil de manter. Sugiro enxugar/arquivar seções históricas.

> **F3 (descartado):** a suspeita de "domínio Resend não verificado" foi **refutada
> pela checagem automática** — o domínio está `verified`. E-mails serão entregues.

---

## 6. Vulnerabilidades de dependência (baseline conhecido)

`npm audit` mantém o baseline já documentado: **20 vulnerabilidades (2 critical,
6 high, 11 moderate, 1 low)**, todas em cadeias intencionalmente não tocadas
(Baileys/QR WhatsApp, jsPDF) ou apenas de dev (eslint). Decisão de escopo registrada
no `replit.md`. **Risco residual aceito** — reavaliar com fix upstream.

---

## 7. Checklist final antes de lançar

- [x] **F2 (código)** — Webhooks de plataforma agora fail-closed (HMAC obrigatório). ✅
- [ ] **F2 (config)** — Configurar `*_WEBHOOK_SECRET` das plataformas em uso para ativá-las (até lá, rejeitam tudo com 503).
- [ ] **F1** — Corrigir o cálculo de churn no painel admin (não bloqueia lançamento).
- [ ] (Opcional) **F4** — Alertar quando OpenAI cair em `demo-mode`.
- [x] Stripe LIVE + webhook protegido ✅
- [x] Mercado Pago + webhook protegido ✅
- [x] Resend domínio verificado (e-mails entregam) ✅
- [x] RLS multi-tenant ✅
- [x] Cálculos financeiros corretos ✅
- [x] Hash de senha persistido corretamente ✅
- [x] Conectividade de todos os serviços ✅

---

## 8. Conclusão

O FlowFunnel está **funcionalmente pronto** e bem arquitetado. As 147 verificações
automáticas passaram, a segurança multi-tenant é robusta (RLS no banco) e os fluxos
de pagamento dos provedores principais (Stripe/Mercado Pago) estão endurecidos e
testados. O único pendente de **configuração** é o F2 (segredos de webhook das
plataformas adicionais). Fechado o F2 e corrigido o F1, a prontidão sobe para a
faixa de **95+/100**.

### Como reproduzir os testes
```bash
npx tsx __tests__/metrics.test.ts        # 20/20
npx tsx __tests__/totp.test.ts           # 21/21
npx tsx __tests__/rls.test.ts            # 17/17
npx tsx __tests__/calculations.test.ts   # 63/63
npx tsx __tests__/integration.live.ts    # 20/20 (app precisa estar rodando)
npx tsx scripts/connectivity-check.ts    # 6/6 + auditoria de config
```
