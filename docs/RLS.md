# Row-Level Security (RLS) — Isolamento Multi-Tenant

Este documento descreve a arquitetura de **Row-Level Security (RLS)** do FlowFunnel:
isolamento absoluto por tenant no nível do PostgreSQL, com política **fail-closed**
(sem contexto de tenant → nenhuma linha visível e nenhuma escrita permitida).

> RLS é a **última linha de defesa**. Os filtros de `userId` na camada de aplicação
> (`where: { userId }`) são mantidos como **camada extra** (defense-in-depth). Mesmo
> que um filtro de aplicação seja esquecido, o banco impede o vazamento entre tenants.

---

## 1. Conceito

O app conecta ao Postgres como a role do `DATABASE_URL` (`postgres`), que é
**superuser + BYPASSRLS** — ou seja, **ignora RLS por padrão**. Para o RLS valer,
toda query de tenant roda dentro de uma transação que:

1. Define o GUC `app.current_user_id` com o id do tenant atual;
2. Executa `SET LOCAL ROLE app_rls` — uma role **sem privilégio** criada só para isso
   (`NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT`), que **respeita** RLS;
3. Executa a query do modelo.

Como `SET LOCAL` e `set_config(..., is_local => true)` são **escopados à transação**,
o efeito é revertido automaticamente ao fim — seguro com pool de conexões.

As policies comparam a coluna de posse (`userId`/`ownerId`/`tenantId`/etc.) com
`current_setting('app.current_user_id', true)`. O segundo argumento `true`
(`missing_ok`) faz o `current_setting` retornar `NULL` em vez de erro quando o GUC
não está definido → nenhuma policy casa → **0 linhas** (fail-closed).

---

## 2. Dois clientes Prisma (`lib/prisma.ts`)

| Cliente | Role efetiva | RLS | Uso |
|---|---|---|---|
| `prisma` | `app_rls` (por operação) | **Ativo** | Fluxos de tenant autenticados (rotas/SSR com sessão) |
| `prismaAdmin` | `postgres` (bypass) | **Ignorado** | Auth, webhooks, cron, admin, fluxos públicos (sem tenant) |

Ambos compartilham o **mesmo** `PrismaClient` base (uma única pool). O `prisma` é uma
extensão (`$extends`) que envelopa **cada** operação de modelo na transação descrita
acima; o `prismaAdmin` é o cliente base puro.

### Resolução do tenant (`resolveTenantUserId()`)

Nesta ordem:

1. **Override explícito** via `runWithTenant(userId, fn)` (AsyncLocalStorage) — para
   scripts, testes, jobs e qualquer execução fora de um request com sessão.
2. **Cookie de sessão NextAuth** do request atual, decodificado com `NEXTAUTH_SECRET`
   (`__Secure-next-auth.session-token` em HTTPS, `next-auth.session-token` em HTTP).
   Retorna `token.id` (ou `token.sub`).

Se nada resolver → `null` → GUC vira `''` → **fail-closed**.

> ⚠️ **Armadilha de AsyncLocalStorage:** operações do Prisma são *PrismaPromises
> preguiçosas* — só executam quando aguardadas. Por isso `runWithTenant` faz
> `await fn()` **dentro** do escopo do ALS; do contrário a leitura do contexto
> aconteceria fora do escopo e o tenant viria nulo.

### Helpers exportados

- `runWithTenant(userId, fn)` — executa `fn` com o tenant fixado via ALS.
- `withTenantTx(fn)` — transação **interativa** com o contexto de tenant aplicado.
  Use no lugar de `prisma.$transaction([...])` (a forma em array **não** compõe com a
  extensão por-operação). Já aplicado em `account/2fa/{disable,activate,recovery-codes}`
  e `campaigns`.

---

## 3. Tabelas protegidas (24)

A migration é `prisma/migrations/20260607000000_enable_rls/migration.sql`
(idempotente). Todas as tabelas abaixo têm `ENABLE` + **`FORCE`** ROW LEVEL SECURITY
(FORCE faz o RLS valer **inclusive para o dono da tabela**) e a policy
`tenant_isolation` (com `USING` para leitura/update/delete e `WITH CHECK` para
insert/update).

### a) Isolamento direto por `userId` (16)

`TwoFactorRecoveryCode`, `PasswordResetToken`, `EmailVerificationToken`,
`MetricSnapshot`, `Account`, `Funnel`, `Integration`, `Goal`, `Notification`,
`WebhookLog`, `Workspace`, `Campaign`, `LeadStatus`, `TrackedLead`, `TrackedEvent`,
`TrackedConversion`.

Policy: `"userId" = current_setting('app.current_user_id', true)`.

### b) Isolamento por coluna alternativa (2)

- `TeamMember` → por `"ownerId"`.
- `AuditLog` → por `"tenantId"` (logs de sistema têm `tenantId NULL`, ficam invisíveis
  a tenants e são escritos/lidos via `prismaAdmin`).

### c) Tabelas filhas, via `EXISTS` no pai (4)

- `FunnelStage`, `FunnelEvent` → pertencem ao tenant dono do `Funnel` (`funnelId`).
- `AffiliateClick` → pertence ao tenant dono do `Affiliate` (`affiliateId`).
- `AffiliateSale` → visível ao usuário referenciado (`userId`) **OU** ao dono do
  `Affiliate`.

### d) Afiliados (1)

- `Affiliate` → por `"userId"` (afiliados externos com `userId NULL` ficam invisíveis a
  tenants; geridos via `prismaAdmin` nos fluxos públicos).

### e) Identidade — `User` (self-only) (1)

- `User` → `"id" = current_setting('app.current_user_id', true)`. O cliente de tenant só
  enxerga/edita o **próprio** registro. Escritas de sistema (NextAuth adapter, registro,
  webhooks, cron, admin) passam por `prismaAdmin` (bypass) e não são afetadas.
- **Leituras cross-user legítimas** foram movidas para `prismaAdmin` (precisam enxergar
  OUTROS usuários, o que a policy self-only esconderia):
  - `app/api/account/email` — checagem de e-mail já em uso (unicidade);
  - `app/api/stripe/activate-trial` — antifraude por fingerprint de cartão.

> **Sem RLS (intencional):** `StripeProcessedEvent`, `MercadoPagoProcessedEvent`,
> `WebhookReplayProtection`, `RateLimit`. São tabelas de sistema (dedup de eventos,
> proteção de replay, rate limiting) sem escopo por tenant, acessadas apenas por
> `prismaAdmin`.

---

## 4. Onde cada cliente é usado

**`prismaAdmin` (bypass)** — sem sessão de tenant:

- `lib/`: `auth`, `audit`, `security-utils`, `webhook-handlers`, `webhook-stages`,
  `webhook-security`, `webhook-tenant`, `webhook-logger`, `webhook-dedup`,
  `stripe-dedup`, `mercadopago-dedup`.
- Rotas: `auth/*`, `webhooks/*` (direto ou via `webhook-handlers`), `cron/*`,
  `admin/*`, `track/{event,conversion}`, `stripe/webhook`, fluxos públicos de
  afiliados, `mercadopago/{process-payment,create-preference}`.

**`prisma` (tenant, RLS)** — request autenticado com sessão:

- Todas as rotas de dashboard/usuário (funis, campanhas, metas, relatórios,
  integrações, conta, etc.) e `lib/withPlan.ts`.

---

## 5. Aplicar a migration

```bash
bash scripts/db-migrate-deploy.sh   # dev e prod (lida com baseline P3005)
npx prisma generate
```

A migration **deve** rodar em produção antes do deploy do código que usa o cliente de
tenant — caso contrário as policies não existem e o `SET LOCAL ROLE app_rls` falharia
por falta de grants.

---

## 6. Testes (`__tests__/rls.test.ts`)

Runner: `npx tsx __tests__/rls.test.ts` (sem jest). Cobre:

1. **Próprio tenant** — cria e lê os próprios dados (inclusive tabela filha via pai).
2. **Acesso cruzado negado** — tenant B não vê/atualiza/deleta dados de A; `WITH CHECK`
   impede A "forjar" linha em nome de B.
3. **Sem contexto (fail-closed)** — 0 linhas em leitura; INSERT rejeitado.
4. **Admin/bypass** — `prismaAdmin` vê todos os tenants.

Inclui também o caso da tabela `User` (self-only): vê o próprio, não vê/atualiza o de
outro tenant, e nada sem contexto.

Resultado esperado: **17 passou, 0 falhou**.

---

## 7. Verificação pré-produção

- `npx tsc --noEmit` — limpo.
- Login/sessão → rota de tenant retorna os dados corretos (validado E2E via
  `/api/usage` com JWT NextAuth minted).
- Webhooks/cron/admin/integrações → usam `prismaAdmin` (sem sessão), não são bloqueados
  por RLS.
- Conferir RLS ativo: `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
  WHERE relrowsecurity` (deve listar as 24 tabelas) e `SELECT count(*) FROM pg_policies`
  (deve ser 24).

---

## 8. Operação e gotchas

- **Nunca** use `prismaAdmin` em rotas de tenant — desliga o isolamento.
- Ao adicionar uma **nova tabela por tenant**, adicione-a à migration RLS (com policy)
  e mantenha o filtro de `userId` na aplicação.
- `SET LOCAL ROLE` exige que a role de conexão possa virar `app_rls` (superuser pode; a
  migration também faz `GRANT app_rls TO current_user` como fallback).
- Conexões via **pooler em modo transaction** são compatíveis (tudo é `SET LOCAL`,
  escopado à transação).
