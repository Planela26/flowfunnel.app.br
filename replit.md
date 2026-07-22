# FlowFunnel SaaS

A Next.js SaaS application for tracking WhatsApp marketing funnels. The platform tracks, qualifies leads and counts interactions — it does NOT send messages to clients. Integrates with Meta/Facebook Ads, Hotmart, Kiwify, Eduzz, and Monetizze via webhooks.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: PostgreSQL via Replit's built-in DB, managed with Prisma ORM
- **Auth**: NextAuth.js v4 with credentials + optional Google OAuth
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: OpenAI API
- **Payments**: Stripe (LIVE mode) + Mercado Pago (PIX/Boleto/Cartão)
- **Email**: Resend

## Running the App

The app runs on port 5000. Start it with:

```bash
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Auto-set by Replit DB |
| `NEXTAUTH_SECRET` | Yes | Random secret for session signing |
| `NEXTAUTH_URL` | Yes | Replit dev domain URL |
| `OPENAI_API_KEY` | Yes | AI suggestions |
| `STRIPE_SECRET_KEY` | Yes | Stripe LIVE secret key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe LIVE publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `RESEND_API_KEY` | Yes | Resend email service |
| `RESEND_FROM_EMAIL` | Optional | Override sender (default: onboarding@resend.dev) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |

## Stripe Plan Price IDs (LIVE)

| Plan | Price ID |
|---|---|
| START (R$97) | `price_1TGC9uHozdjtX6AC911xvx53` |
| PRO (R$147) | `price_1TGC9vHozdjtX6ACKP2DaHka` |
| SCALE (R$297) | `price_1TGC9vHozdjtX6ACbY8LxBeG` |

Set these as env vars: `STRIPE_PRICE_START`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE`.

## Plan Limits

| Plan | Price | Conversas/mês |
|---|---|---|
| FREE | R$0 | 0 (bloqueado) |
| START | R$97 | 1.000 |
| PRO | R$147 | 3.000 |
| SCALE | R$297 | Ilimitadas |

## Features Implemented

- **Mobile navigation** — drawer sidebar + hamburger button
- **Conversation limits** — UsageBar component + `/api/usage` endpoint
- **Onboarding modal** — 3-step modal (localStorage-gated)
- **Admin user panel** — `/admin/users` with MRR and plan breakdown (ADMIN only)
- **Kiwify card** — dashboard metric card from FunnelEvents
- **Period comparison** — current vs previous period % change
- **CSV export** — `/api/reports/export-csv` button in dashboard header
- **Webhook retry** — `/api/webhooks/retry` + retry button in webhooks UI
- **Password reset** — `/forgot-password` + `/reset-password` with email link via Resend. Tokens são armazenados como hash SHA-256 (o token bruto só vai no link do e-mail); `reset-password` hasheia o token recebido antes do lookup. Validação de expiração e uso único preservadas
- **Email notifications** — welcome (on register), sale confirmed, usage limit warning (80%)
- **Billing page** — `/billing` with plan comparison, upgrade buttons, Stripe portal link
- **Goals page** — `/goals` with CRUD metas, progress bars, status (active/completed)
- **UsageMeter** — dashboard usage bar showing conversas used vs plan limit in real time
- **Webhook limit enforcement** — WhatsApp webhook returns 429 when plan limit exceeded
- **Webhooks docs** — `/webhooks` now includes setup guide with copy-to-clipboard URLs for each platform
- **Mobile responsiveness** — dashboard KPI grids use `sm:grid-cols-2` breakpoint
- **Landing page** — Testimonials section (6 depoimentos) + FAQ accordion (7 perguntas)
- **Account self-service** — `/account` page (change password / change email / delete account) + `/api/account/{password,email,delete}`
- **Email verification** — `EmailVerificationToken` model + verification email on register, `/verify-email`, `/api/auth/verify-email`, `/api/auth/resend-verification`. Soft block via `EmailVerificationBanner` shown in `AppShell`. Existing users backfilled to `emailVerified=now`.
- **Páginas legais** — `/termos` (Termos de Uso) e `/privacidade` (Política de Privacidade/LGPD), exigidas por Stripe e LGPD. Linkadas no footer + middleware público.
- **Webhook stage mapping** — `lib/webhook-stages.ts` centraliza mapeamento de status de plataformas para estágios granulares (Recusado/Reembolsado/Chargeback/Abandonado). Usado por Eduzz, Kiwify, Monetizze, Perfect Pay. **Segurança (fail-closed)**: as rotas de Eduzz/Kiwify/Monetizze/Perfect Pay (URL legada + tokenizada) passam `requireSecret: true` para `guardWebhook` — se o `*_WEBHOOK_SECRET` correspondente NÃO estiver configurado, a rota **rejeita** (HTTP 503), **não processa** e **loga um alerta** (`🚨 [webhook-security] ALERTA`). Com o segredo presente, a assinatura HMAC é OBRIGATÓRIA (assinatura ausente/inválida → 403). Hotmart é fail-closed pelo hottok por tenant (403 se ausente) + HMAC opcional. Relatório de status: `npx tsx scripts/webhook-protection-report.ts` (gera `WEBHOOK_SECURITY_REPORT.md`). Teste: `npx tsx __tests__/webhook-failclosed.test.ts` (9/9).
- **Daily metric snapshots** — `MetricSnapshot` model + `POST /api/cron/snapshot` (Bearer `CRON_SECRET` no header Authorization). `/api/analytics/timeseries` consulta snapshots para dias passados (mais barato/estável) e agrega eventos em tempo real apenas para hoje. Configure scheduled deployment para rodar diariamente.
- **Stripe payment hardening** — All payment routes (`confirm-boleto`, `activate-plan`, `embedded-checkout`, `portal`) have rate limiting keyed by user ID. `confirm-boleto` verifies PI ownership (customer match) before confirming. Webhook has in-memory event dedup, skips plan activation for `incomplete` subscriptions, and only downgrades on `invoice.payment_failed` after last retry (`next_payment_attempt` is null). `subscription` GET gracefully handles deleted Stripe subscriptions (resets to FREE instead of 500). `getPlanFromPriceId` uses conditional map to avoid empty-string key collision.
- **7-day free trial** — `trialEndsAt: DateTime?` + `trialPlan: String?` on User model. Registration with `?plan=START|PRO|SCALE` activates a 7-day trial (plan stays `FREE` in DB; `getEffectivePlan()` in `lib/trial.ts` returns `trialPlan` while active). `GET /api/plan` returns `trialActive`, `trialDaysLeft`, `trialExpired`, `trialPlan`. `TrialBanner` (countdown in AppShell). `withPlan.ts`, WhatsApp webhook, and usage route all use `getEffectivePlan` so limits apply correctly during trial. Pricing page CTAs → `/register?plan=XXX` for non-logged-in users. Register page shows "7 dias grátis do Plano XXX — sem precisar de cartão" badge when plan param present.

- **Read-only mode on expiry (NO platform block)** — quando o plano vence (teste grátis expirado OU assinatura cancelada/expirada/`past_due` além do período de carência), a plataforma **NÃO** é bloqueada: nada de tela de bloqueio, overlay, redirecionamento ou cliques bloqueados. Todos os dados/gráficos/funis existentes continuam visíveis e a navegação funciona normalmente. Apenas um **banner discreto no topo** (`components/PlanExpiredBanner.tsx`, dispensável) aparece com a mensagem "Seu plano está vencido. Você não receberá novos dados, leads ou atualizações até renovar sua assinatura." + botão de renovar (vai para `/checkout?plan=X` se for trial, senão `/billing`). O antigo `TrialExpiredWall` (overlay full-screen) e o redirect global em `middleware.ts` para `/subscription-required` foram **removidos**. O que muda de fato: a **ingestão de novos dados é interrompida** até a renovação. `lib/account-status.ts` centraliza `isAccountExpired(user)` (combina `isSubscriptionBlocked` + `isTrialExpiredForToken`) e `isIngestionBlockedForUser(userId)` (consulta o banco via `prismaAdmin`, **fail-open** em erro de DB — se o banco está fora, o write de ingestão falharia de qualquer forma). Gates de ingestão aplicados em: `lib/webhook-handlers.ts` (Hotmart/Kiwify/Eduzz/Monetizze/PerfectPay), `app/api/webhooks/whatsapp/route.ts` (mensagens **e** status updates — qualquer payload com `userId` resolvido), `app/api/track/event/route.ts` e `app/api/track/conversion/route.ts`. Rotas de ingestão bloqueada retornam `{ skipped: true, reason: 'subscription_expired' }` (HTTP 200, para a plataforma de origem não reenviar). `GET /api/subscription/status` agora também retorna `trialExpired`, `trialPlan` e `expired`.
- **Automatic alerts (SCALE)** — `POST /api/cron/alerts` (Bearer `CRON_SECRET`) avalia 4 regras (queda de vendas 7d, conversão abaixo da meta, campanha sem leads em 24h, gasto sem retorno em 48h) e cria `Notification` com `type='alert'`. Toggles por usuário em `/settings`, persistidos em `User.alertSettings` (JSON). Feature `automatic_alerts` em `lib/plans.ts` (mínimo SCALE). Configure scheduled deployment para rodar uma vez por dia.

## Admin Account

- Email: `atriosouza13@gmail.com`
- Role: `ADMIN`

## Webhook Endpoints (public — no auth required)

| Endpoint | Platform |
|---|---|
| `POST /api/webhooks/whatsapp` | WhatsApp Cloud API |
| `POST /api/webhooks/hotmart` | Hotmart |
| `POST /api/webhooks/eduzz` | Eduzz |
| `POST /api/webhooks/monetizze` | Monetizze |
| `POST /api/webhooks/kiwify` | Kiwify |
| `POST /api/webhooks/mercadopago` | Mercado Pago (PIX/Boleto/Cartão) |

## Mercado Pago Integration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Yes | Access token (APP_USR-...) — backend only |
| `MERCADOPAGO_PUBLIC_KEY` | Yes | Public key (APP_USR-...) — used by the embedded Payment Brick (frontend) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Yes | Webhook secret for HMAC signature verification |

### Checkout Flow (EMBEDDED — Payment Brick)

O checkout do Mercado Pago é **embedado dentro da plataforma** (não redireciona pra
fora), igual ao Stripe Elements. Usa o **Payment Brick** (`@mercadopago/sdk-js` via
`https://sdk.mercadopago.com/js/v2`).

1. User visits `/checkout?plan=START|PRO|SCALE` (public, no auth required)
2. Prices loaded from `/api/plan-prices` (backend-only, no frontend pricing logic)
3. Frontend busca a public key em `GET /api/mercadopago/public-key` e renderiza o
   Payment Brick no `#paymentBrick_container` com `amount = preço com desconto`
4. O brick exibe Cartão (crédito/débito), PIX e Boleto. **O campo de CPF aparece
   nativamente só quando o usuário seleciona PIX** (o brick coleta
   `payer.identification`), e o Mercado Pago autentica o CPF ao gerar o QR Code
5. `onSubmit` envia `formData` (token/installments/payment_method_id/payer) para
   `POST /api/mercadopago/process-payment`
6. O backend valida cupom/afiliado server-side, recalcula o preço, e cria o
   pagamento via `POST /v1/payments` (com `X-Idempotency-Key`):
   - **Cartão aprovado** → redireciona pra `/checkout/success`
   - **PIX** → retorna `qr_code` + `qr_code_base64`; o checkout exibe o QR Code +
     botão "copiar" inline (sem sair do site)
   - **Boleto** → retorna a URL do boleto; o checkout exibe o link
   - `in_process`/`pending` → `/checkout/pending`
7. Webhook `POST /api/webhooks/mercadopago` confirma o pagamento e ativa o plano:
   - `approved` → upgrade user plan + send audit log
   - `cancelled`/`refunded` → downgrade to FREE

> O endpoint legado `POST /api/mercadopago/create-preference` (redirect via
> `init_point`) permanece disponível mas **não é mais usado** pelo checkout.

### Security

- **Webhook HMAC signature**: `x-signature` header verified with `MERCADOPAGO_WEBHOOK_SECRET` (fail-closed: 401 if not configured)
- **Rate limiting**: `process-payment` e `create-preference` limitados a 10 req/min por IP
- **No frontend pricing**: all prices decided server-side; frontend never sees payment logic
- **Idempotency**: `X-Idempotency-Key` (UUID) no `POST /v1/payments`; dedup de webhook events persistido no banco (`MercadoPagoProcessedEvent`, chave `${paymentId}:${status}`) via `lib/mercadopago-dedup.ts` (claim/release — espelha `lib/stripe-dedup.ts`). Sobrevive a restart/múltiplas instâncias; libera a claim em caso de falha de processamento (retry at-least-once)
- **External reference**: `userId:planKey` or `userId:planKey:affiliateId` for attribution
- **Public key isolada**: só a public key vai pro frontend (via `/api/mercadopago/public-key`); o access token nunca sai do backend
- **CSP**: `connect-src`/`frame-src` liberam `*.mercadopago.com`, `*.mercadolibre.com`, `*.mlstatic.com` para o SDK/Brick funcionar

## Database

Managed with Prisma. To apply schema changes:

```bash
npx prisma db push
npx prisma generate
```

## Security & Performance Hardening (final hardening pass)

- **Content Security Policy** — `middleware.ts` emite uma CSP por requisição via
  `buildCsp()` + `withCsp()` (aplicada a todos os caminhos de retorno).
  `script-src 'self' 'unsafe-inline' https:` (+ `'unsafe-eval'` apenas em dev),
  `style-src 'unsafe-inline'`, `connect-src` self + Stripe/Mercado Pago (+
  `ws:`/`wss:` em dev p/ HMR), `frame-src` self + `*.stripe.com`/`*.mercadopago.com`,
  `frame-ancestors` self + domínios dev do Replit, `object-src 'none'`,
  `base-uri 'self'`. **NÃO usar `nonce` + `'strict-dynamic'`**: o middleware roda
  por request e gera um nonce novo a cada chamada, mas o HTML das páginas é
  pré-renderado no build do Next (sem nonce embutido), então com `strict-dynamic`
  o browser bloqueava TODOS os scripts do Next em produção → sem hidratação,
  páginas travadas em skeleton. `'unsafe-inline'` é compatível com páginas
  estáticas. Funciona em dev (tudo dinâmico) e quebra em prod (estático) — sempre
  validar CSP no app publicado, não só no preview.
- **Índices de performance** — migration idempotente
  `prisma/migrations/20260530000000_add_perf_indexes` (CREATE/DROP INDEX IF
  [NOT] EXISTS): `@@index([userId])` em `Account` e `Funnel`; composto
  `@@index([funnelId, timestamp])` em `FunnelEvent` (substitui o antigo só por
  `funnelId`); composto `@@index([userId, createdAt])` em `WebhookLog`. Aplicada
  via `bash scripts/db-migrate-deploy.sh`.
- **Cron sem N+1** — `app/api/cron/snapshot` e `app/api/cron/alerts` foram
  refatorados para buscar dados em lote (poucas queries: `findMany`/`groupBy`
  agregados) e avaliar em memória, em vez de loops de query por usuário/campanha.
  Resultado idêntico ao anterior (mesmos thresholds, títulos e mensagens).
  `alerts` exige `CRON_SECRET` (header `Authorization: Bearer`); `snapshot` exige
  o mesmo quando `CRON_SECRET` está setado.
- **Disaster Recovery** — runbook em `docs/DISASTER_RECOVERY.md` (RPO/RTO +
  restauração via backups gerenciados do Replit) e script de export lógico
  `scripts/db-backup.sh` (pg_dump → `.sql.gz` em `backups/`, ignorado pelo git).
  Restauração: `gunzip -c <dump> | psql "$TARGET_DATABASE_URL"`.
- **Dependências (sem upgrade — baseline mantido por decisão de escopo)** —
  Nenhum upgrade de dependência foi aplicado. `npm audit fix` foi avaliado mas
  **revertido**, pois a única forma de "corrigir" os avisos é subir cadeias
  explicitamente fora de escopo. Auditoria permanece no baseline: **20
  vulnerabilidades (2 critical, 6 high, 11 moderate, 1 low)**. Mapeamento do
  porquê cada aviso `fixAvailable` NÃO pode ser corrigido aqui:
  - `ws`, `protobufjs`, `libsignal-node`, `@whiskeysockets/baileys` → só existem
    via **Baileys** (cadeia do QR do WhatsApp — proibido tocar).
  - `jspdf`, `dompurify` → cadeia do **jsPDF** (export de PDF — proibido tocar).
  - `resend`/`svix` → exigiriam upgrade funcional da lib de e-mail (fora de
    escopo desta task).
  - `next`, `next-auth`, `nodemailer`, `postcss`, `uuid`,
    `@next-auth/prisma-adapter` → `fixAvailable=false` (sem fix upstream).
  - `ajv`, `brace-expansion`, `flatted`, `minimatch`, `picomatch` → transitivos
    **somente de dev** (eslint), não chegam ao runtime de produção.
  **Riscos residuais aceitos**: `@whiskeysockets/baileys` pinado em `7.0.0-rc.9`
  (subir a cadeia protobufjs/libsignal quebraria o QR do WhatsApp) e `jspdf`
  pinado (sem fix upstream; export de PDF intocado). Reavaliar quando houver fix
  upstream que não atinja essas cadeias.

## Row-Level Security (RLS) — Isolamento Multi-Tenant

Isolamento absoluto por tenant no nível do PostgreSQL (**fail-closed**), mantendo os
filtros de `userId` da aplicação como camada extra (defense-in-depth). Arquitetura
completa em `docs/RLS.md`.

- **Dois clientes Prisma** (`lib/prisma.ts`, mesma pool base):
  - `prisma` — cliente de **tenant**: cada operação roda numa transação que faz
    `set_config('app.current_user_id', …)` + `SET LOCAL ROLE app_rls` (role
    `NOBYPASSRLS`) → o Postgres filtra por RLS. Use em **toda rota/SSR autenticada**.
  - `prismaAdmin` — **bypass** (permanece `postgres`, superuser/BYPASSRLS). Use SOMENTE
    em fluxos sem tenant: `auth/*`, `webhooks/*` (e `lib/webhook-*`), `cron/*`,
    `admin/*`, `track/{event,conversion}`, `stripe/webhook`, afiliados públicos,
    `mercadopago/*`. **Nunca** em rotas de tenant.
- **Resolução do tenant** (`resolveTenantUserId`): override via `runWithTenant()`
  (AsyncLocalStorage, p/ scripts/testes/cron) → senão decodifica o cookie de sessão
  NextAuth com `NEXTAUTH_SECRET`. Sem resolução → GUC `''` → 0 linhas / writes negados.
  - ⚠️ `runWithTenant` faz `await fn()` **dentro** do escopo do ALS porque as ops do
    Prisma são preguiçosas (só executam ao serem aguardadas); fora do escopo o tenant
    viria nulo.
  - `withTenantTx(fn)` substitui `prisma.$transaction([...])` (a forma array não compõe
    com a extensão por-operação). Usado em `account/2fa/{disable,activate,recovery-codes}`
    e `campaigns`.
- **Migrations** (idempotentes): `20260607000000_enable_rls` (role `app_rls`, grants,
  `ENABLE`+`FORCE` RLS + policy `tenant_isolation` em 23 tabelas) +
  `20260607010000_enable_rls_user` (RLS self-only em `User`). Aplicar com
  `bash scripts/db-migrate-deploy.sh` **antes** do deploy do código (em dev e prod).
- **24 tabelas protegidas**: 16 por `userId` (TwoFactorRecoveryCode, PasswordResetToken,
  EmailVerificationToken, MetricSnapshot, Account, Funnel, Integration, Goal,
  Notification, WebhookLog, Workspace, Campaign, LeadStatus, TrackedLead, TrackedEvent,
  TrackedConversion); `TeamMember` por `ownerId`; `AuditLog` por `tenantId`;
  `FunnelStage`/`FunnelEvent` via `EXISTS` no `Funnel`; `Affiliate` por `userId`;
  `AffiliateClick` via `Affiliate`; `AffiliateSale` por `userId` OU dono do `Affiliate`;
  `User` **self-only** (`id = app.current_user_id`). As 2 leituras cross-user legítimas
  de `User` (unicidade de e-mail em `account/email`; antifraude de fingerprint em
  `stripe/activate-trial`) usam `prismaAdmin`.
  **Sem RLS (intencional)**: `StripeProcessedEvent`, `MercadoPagoProcessedEvent`,
  `WebhookReplayProtection`, `RateLimit` (tabelas de sistema via `prismaAdmin`).
- **Testes**: `npx tsx __tests__/rls.test.ts` (próprio tenant / cross-tenant negado /
  sem contexto negado / User self-only / admin bypass) → **17 passou, 0 falhou**.

## Key Directories

- `app/` — Next.js App Router pages and API routes
- `app/api/` — Backend API routes (auth, webhooks, integrations, etc.)
- `components/` — Reusable React components
- `lib/` — Utility functions, Prisma client, email (Resend)
- `prisma/` — Database schema

## Landing Page Tracking (UTM → Lead → Conversion)

Public JS tracker em `public/tracker.js`. Cada usuário do SaaS tem um `siteId`
(= `User.id`) e instala o snippet:

```html
<script async src="https://SEU-SAAS/tracker.js" data-site="USER_ID"></script>
```

O tracker:
- Captura `utm_source/campaign/medium/content/term` da URL e persiste em localStorage
- Gera/recupera `lead_id` único em localStorage
- Dispara `page_view` automaticamente
- Detecta links de checkout (Hotmart/Kiwify/Eduzz/Monetizze/Stripe) e injeta
  `lead_id` + UTMs nas URLs
- Rastreia cliques em links de WhatsApp (`wa.me`, `api.whatsapp.com`)
- Expõe `window.trackEvent(name, meta)` e `window.zfTrackConversion(value, product)`
- Usa `navigator.sendBeacon` para garantir entrega antes do navigate

Modelos novos no Prisma: `TrackedLead` (UTMs originais), `TrackedEvent`
(page_view / click_checkout / click_whatsapp / customizado), `TrackedConversion`.

Endpoints:
- `POST /api/track/event` — público (CORS *), aceita `{site, lead_id, event, url, utm, meta}`
- `POST /api/track/conversion` — público (CORS *), aceita `{site, lead_id, value, product}`
- `GET /api/track/stats?days=N` — autenticado, agrega visitas/cliques/conversões/UTM
- `GET /api/track/install` — autenticado, devolve snippet pronto pro usuário copiar

Os endpoints públicos foram adicionados em `middleware.ts:publicApiRoutes`.

Componente `LandingTracking.tsx` mostra os 4 KPIs, ranking de origens UTM e um
acordeão com instruções de instalação (com botão "copiar"). Renderizado no
dashboard logo antes da seção de Inteligência de Conversão.

## Plan Differentiation (START vs PRO)

Central plan logic lives in `lib/plans.ts` (types, limits, history days, feature
matrix). Backend routes use `lib/withPlan.ts` → `requireFeature(feature)` to gate
PRO-only endpoints (returns HTTP 402 with `upgradeUrl`).

PRO-only features (visible in UI as locked previews for FREE/START):
- `lead_scoring` / `lead_classification` — score 0–100, quente/morno/frio
- `wasted_traffic` — cliques sem conversão + estimativa de R$ desperdiçado
- `smart_suggestions` — pause campanha X / invista em Y
- `full_history` — START/FREE = 7 dias, PRO/SCALE = 365 dias
- `detailed_diagnostic`, `detailed_insights`, `campaign_actions`
- `period_comparison` — `/api/analytics/comparison` retorna 402 para FREE/START

Resource limits enforced server-side (centralizados em `PLAN_FUNNEL_LIMITS`,
`PLAN_WHATSAPP_LIMITS`):
- Funis ativos: START=1, PRO=3, SCALE=∞ — enforced em `POST /api/funnel` e
  `POST /api/workspaces` (caminho real do dashboard "+ Novo funil")
- Números WhatsApp: START=1, PRO=3, SCALE=∞ — enforced em
  `POST /api/integrations/whatsapp`
- Histórico timeseries/relatórios: parâmetro `days` (ou `startDate`) é clampado
  por `getHistoryLimitDays(plan)` em `/api/analytics/timeseries`,
  `/api/reports`, `/api/reports/export-csv` e `/api/reports/export-pdf` —
  FREE/START ficam capados em 7 dias.
- Todos retornam **HTTP 402** com payload `{ error: 'plan_limit_reached',
  resource, currentPlan, limit, current, message, upgradeUrl }`

Pricing page (`app/pricing/page.tsx`): features marcadas como "(em breve)" e
`included: false` quando ainda não implementadas (Análise de tendências,
Alertas automáticos, Multiusuário no SCALE; idem PRO/START quando aplicável).
"IA avançada com alertas" do SCALE foi reescrita para "IA avançada (sugestões +
diagnóstico)" para refletir o que existe.

New endpoints:
- `GET /api/plan` — plano atual + features liberadas (consumido pelo hook `usePlan`)
- `GET /api/leads/scored` — leads classificados (PRO+, retorna 402 caso contrário)
- `GET /api/dashboard/upgrade-triggers` — banners dinâmicos baseados em dados reais

New components:
- `PlanGate` — wrapper que aplica blur + lock + CTA quando `unlocked={false}`
- `UpgradeTriggers` — banners dinâmicos dispensáveis (localStorage)
- `LeadIntelligence` — leads scorados (preview com dados de exemplo se bloqueado)
- `WastedTrafficCard` — desperdício + sugestões inteligentes
- `usePlan` (hook) — expõe `{ plan, features, historyDays, … }` no client

## Replit Notes

- Dev script uses `-p 5000 -H 0.0.0.0` for Replit compatibility
- `NEXTAUTH_URL` set to Replit dev domain
- Email sender uses `onboarding@resend.dev` until custom domain is verified on Resend
