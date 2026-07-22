# Auditoria de Segurança, Escalabilidade e Confiabilidade — FlowFunnel SaaS

> **Escopo:** auditoria somente-leitura. Nenhuma funcionalidade foi alterada.
> **Stack auditada:** Next.js 16 (App Router) · Prisma/PostgreSQL · NextAuth v4 (JWT) · Stripe (LIVE) · Resend · Baileys (WhatsApp).
> **Data:** 30/05/2026 · **Método:** análise estática do código (`app/`, `lib/`, `prisma/`, `middleware.ts`, `next.config.js`), `npm audit`, e mapeamento das 92 rotas de API.

---

## 1. Score Geral

### **68 / 100** — Base sólida, com lacunas críticas em dependências, autenticação de webhooks e rastreabilidade.

A aplicação tem fundamentos **muito bons** (isolamento multi-tenant consistente, criptografia de secrets em repouso, bcrypt 12, proteção contra timing-attack, dedup persistente de Stripe, tokenização de webhooks). O que derruba a nota são: **20 vulnerabilidades em dependências** (2 críticas, 7 altas), **validação HMAC sobre corpo re-serializado** (não raw body), **rate limiting em memória + ausente em rotas de auth**, e **ausência total de trilha de auditoria**.

### Score por área

| Área | Score | Resumo |
|---|---|---|
| **Frontend** | 78 | Sem JWT em localStorage, headers de segurança presentes. Falta CSP. |
| **Backend** | 72 | RBAC e isolamento bons; webhooks com HMAC frágil; sem audit log. |
| **Banco de dados** | 75 | Constraints de idempotência ótimas; faltam índices em FKs quentes. |
| **Infraestrutura** | 60 | Backup/RPO/RTO não definidos; rate limit não distribuído. |
| **Segurança** | 62 | Deps vulneráveis (crítico), enumeração de usuário, replay em webhooks. |
| **Performance** | 70 | N+1 nos crons; full-scan potencial em tabelas grandes de eventos. |

---

## 2. Top 20 Problemas (ordenados por gravidade)

| # | Gravidade | Problema | Localização |
|---|---|---|---|
| 1 | 🔴 Crítico | `next` com múltiplos CVEs (bypass de middleware/proxy, CSRF, SSRF, cache poisoning) | `package.json` → next |
| 2 | 🔴 Crítico | `jspdf` ≤4.2.0 — injeção de objeto PDF / execução de JS | `app/api/reports/export-pdf` |
| 3 | 🔴 Crítico | `protobufjs` ≤7.5.7 — execução arbitrária de código (via Baileys) | `@whiskeysockets/baileys` |
| 4 | 🔴 Crítico | HMAC de webhooks valida `JSON.stringify(body)` e **não** o raw body | todas as rotas `app/api/webhooks/*` |
| 5 | 🟠 Alto | `lodash` ≤4.17.23 — code injection / prototype pollution | dependência transitiva |
| 6 | 🟠 Alto | Sem rate limit em **login / registro / esqueci-senha** | `lib/auth.ts`, `app/api/auth/*` |
| 7 | 🟠 Alto | Rate limit em memória (`globalThis Map`) — inútil em multi-instância/restart | `lib/security-utils.ts` |
| 8 | 🟠 Alto | **Ausência total de trilha de auditoria** (login, senha, exclusão, pagamentos) | (não existe model `AuditLog`) |
| 9 | 🟠 Alto | Webhooks sem validação de **timestamp** → replay attack | `app/api/webhooks/*` |
| 10 | 🟠 Alto | `minimatch` / `picomatch` / `flatted` — ReDoS / prototype pollution | transitivas (build) |
| 11 | 🟡 Médio | Enumeração de usuários no registro e em `check-email` | `app/api/auth/register`, `app/api/auth/check-email` |
| 12 | 🟡 Médio | `dompurify` ≤3.3.3 — múltiplos bypass de XSS | transitiva |
| 13 | 🟡 Médio | Sem **Content-Security-Policy** (CSP) | `next.config.js` |
| 14 | 🟡 Médio | Índices ausentes: `Funnel(userId)`, `Account(userId)`, `FunnelStage(funnelId)` | `prisma/schema.prisma` |
| 15 | 🟡 Médio | N+1 nos crons (loop por usuário com queries internas) | `app/api/cron/snapshot`, `app/api/cron/alerts` |
| 16 | 🟡 Médio | Full-scan potencial em `FunnelEvent`/`WebhookLog` (falta índice composto) | `app/api/analytics/timeseries`, `app/api/leads` |
| 17 | 🟡 Médio | JWT de 14 dias sem revogação server-side (logout não invalida) | `lib/auth.ts` |
| 18 | 🟡 Médio | Backup/RPO/RTO não definidos nem documentados | infraestrutura |
| 19 | 🟢 Baixo | CORS `*` nos endpoints públicos de tracking → poluição de dados | `app/api/track/event`, `app/api/track/conversion` |
| 20 | 🟢 Baixo | `nodemailer` (via next-auth) / `postcss` / `ws` — moderadas | transitivas |

---

## 3. Detalhamento por Etapa

### ETAPA 1 — Segurança do Frontend  ·  **78/100**

**✅ Pontos fortes**
- **Nenhum JWT/token sensível em `localStorage`.** O uso de `localStorage` se limita a consentimento de cookies, tema e flags de UI (`components/CookieConsent.tsx`, `contexts/ThemeContext.tsx`, `components/UpgradeTriggers.tsx`). A sessão usa cookie `httpOnly` do NextAuth.
- **Headers de segurança configurados** em `next.config.js`: HSTS (2 anos + preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (anti-clickjacking), `Referrer-Policy`, `Permissions-Policy`.
- Sem uso de `eval`/`new Function`. `dangerouslySetInnerHTML` aparece apenas para JSON-LD estático e controlado em `app/layout.tsx` (baixo risco).

**🟡 Achados**
- **[Médio] Ausência de CSP** (`Content-Security-Policy`). Sem CSP, qualquer XSS introduzido futuramente tem exploração total. **Correção:** adicionar política restritiva (idealmente com nonce para scripts).
- **[Baixo] `siteId = User.id` exposto** no snippet público de tracking (`app/api/track/install/route.ts`). É by-design para o pixel, mas o ID do usuário vira público — ver Etapa 2.

---

### ETAPA 2 — Controle de Permissões (RBAC / Multi-Tenant)  ·  **82/100**

**✅ Pontos fortes (isolamento de tenant é o ponto mais forte do sistema)**
- **Todas as rotas sensíveis usam `getServerSession(authOptions)`** e rejeitam não autenticados com 401.
- **Filtro por `userId`/`ownerId` consistente** em funnels, workspaces, goals, leads, notifications, integrations, analytics e reports.
- **IDOR mitigado corretamente** via queries escopadas:
  - `app/api/goals/[id]` e `app/api/notifications/[id]`: `updateMany/deleteMany` com `{ id, userId }`.
  - `app/api/workspaces`: `findFirst({ id, userId })` antes de mutar.
  - `app/api/team`: `{ id, ownerId }`.
- **RBAC admin** via `role !== 'ADMIN'` ou `requireAdmin()` (`lib/requireAdmin.ts`) em `app/api/admin/users` e `app/api/affiliates/*`.

**🟡 Achados**
- **[Baixo] Poluição de dados em tracking público.** `app/api/track/event` aceita `site` (= `userId`) e ingere eventos para esse usuário. Como o `userId` é exposto publicamente no snippet, um terceiro pode injetar `page_view`/conversões falsas. **Correção:** rate limit por IP+site (já há rate limit; reforçar) e/ou um token de site separado do `userId`.
- **Observação:** não foi encontrada nenhuma rota que busque/edite/exclua por ID sem filtro de propriedade. **Não há IDOR clássico.**

---

### ETAPA 3 — Rate Limiting  ·  **55/100**

**🟠 Achados**
- **[Alto] Login, registro e esqueci-senha SEM rate limit explícito.**
  - `lib/auth.ts` (`authorize`) não aplica `checkRateLimit` → **brute force / credential stuffing**.
  - `app/api/auth/register` → criação de contas em massa / spam.
  - `app/api/auth/forgot-password` → **abuso de envio de e-mail** (custo Resend + spam para vítimas).
- **[Alto] Rate limit é em memória** (`globalThis.Map` em `lib/security-utils.ts:checkRateLimit`). Consequências:
  - Zera a cada restart/deploy.
  - **Não compartilha estado entre instâncias** — em deployment autoscale, cada réplica tem seu próprio contador, multiplicando o limite efetivo.
- **✅** Há rate limit em troca de senha (5/min), reenvio de verificação (3/min), exclusão de conta (3/min), `check-email` (30/min/IP) e webhooks (120/min por token).

**Correção:** mover para store distribuído (ex.: tabela Postgres com TTL, ou Redis se disponível) e cobrir login/registro/forgot-password (recomendado: 5–10/min por IP + por e-mail).

---

### ETAPA 4 — Logs de Auditoria  ·  **30/100**

**🟠 Achado [Alto] — lacuna estrutural**
- **Não existe nenhum model de auditoria** (`AuditLog`) no schema, nem gravação de eventos críticos. Não há registro de **quem fez, quando, IP, tenant e resultado** para: login/logout, troca de senha, troca de e-mail, alteração de permissões/role, exclusão de conta/dados, pagamentos e mudanças de assinatura, conexão/desconexão de integrações.
- **Impacto:** impossível investigar incidentes, fraude, ou disputas de cobrança; não atende requisitos de compliance (LGPD art. 37 — registro de operações).
- **✅ Bom:** logs de webhook usam `sanitizeForLog()` e nenhum log imprime senha/secret em texto puro (apenas presença/ausência, ex.: `clientSecret: FOUND/NULL`).

**Correção:** criar model `AuditLog { id, userId, tenantId, action, ip, userAgent, metadata Json, result, createdAt }` e gravar nos pontos críticos. Retenção mínima 90 dias.

---

### ETAPA 5 — Backup e Recuperação  ·  **58/100**

**🟡 Achados**
- **[Médio] RPO/RTO indefinidos.** O banco é o PostgreSQL gerenciado do Replit; os *checkpoints* do Replit cobrem rollback de desenvolvimento, mas **não há uma política documentada de backup automático de produção, frequência, retenção e criptografia**, nem um procedimento testado de restauração.
- **Não há export/snapshot lógico** agendado (ex.: `pg_dump` periódico para storage externo).

**Correção:**
- Definir e documentar: backup diário automático, retenção 7–30 dias, criptografia em repouso.
- Estabelecer **RPO ≤ 24h** e **RTO ≤ 4h** como meta inicial e **testar a restauração** (drill).
- Para produção no Replit: validar a política de backups do plano de deployment e complementar com `pg_dump` agendado se necessário.

---

### ETAPA 6 — Webhooks e HMAC  ·  **60/100**

**✅ Pontos fortes**
- **Isolamento multi-tenant via token** (`Integration.webhookToken @unique`) nas rotas `/api/webhooks/<plataforma>/[token]`. Rotas legadas recusam quando ambíguo (409).
- **Dedup persistente do Stripe** (`StripeProcessedEvent.eventId @unique`, `lib/stripe-dedup.ts`) — sobrevive a restart e a entregas concorrentes.
- **Dedup de transação** por plataforma (`lib/webhook-dedup.ts` — `isDuplicateTransaction`).
- HMAC com `crypto.timingSafeEqual` (`lib/security-utils.ts`).
- Quando `*_WEBHOOK_SECRET` está configurado, a assinatura é **obrigatória** (rejeita ausência do header).

**🔴 Achado [Crítico] — HMAC sobre corpo re-serializado**
- A verificação assina **`JSON.stringify(body)`** após `await request.json()`, e **não o raw body** recebido:
  - `app/api/webhooks/hotmart/route.ts:26` → `const rawBody = JSON.stringify(body)` → usado em `verifyHmacSignature`.
  - `app/api/webhooks/kiwify/[token]/route.ts:23` → `verifyHmacSignature(JSON.stringify(body), sig, ...)`.
  - Mesmo padrão em eduzz/monetizze/perfect-pay (tokenizadas e legadas).
- **Risco:** a plataforma assina os **bytes exatos** que envia. Reserializar via `JSON.stringify` altera ordem de chaves, espaçamento, acentuação/unicode e formatação numérica → o HMAC recalculado **diverge do original**. Isso causa **falsos negativos** (webhooks legítimos rejeitados) e, dependendo da normalização, enfraquece a garantia de integridade. É exatamente o anti-padrão que a ETAPA 6 pede para evitar.
- **Correção:** capturar `const raw = await request.text()` e validar o HMAC sobre `raw`; só então `JSON.parse(raw)`.

**🟠 Achado [Alto] — Replay attack**
- Não há **validação de timestamp** nos webhooks (Stripe tem tolerância nativa, mas Hotmart/Kiwify/Eduzz/Monetizze/Perfect Pay não validam `X-*-Timestamp`). Um atacante que capture um payload assinado pode reenviá-lo. O dedup por `txId` mitiga vendas duplicadas, mas não eventos sem txId estável.
- **Correção:** rejeitar payloads com timestamp fora de uma janela (ex.: ±5 min) quando a plataforma fornecer o header.

---

### ETAPA 7 — Banco de Dados  ·  **75/100**

**✅ Pontos fortes (constraints de idempotência exemplares)**
- `StripeProcessedEvent.eventId @unique`, `Integration.webhookToken @unique`.
- `@@unique([userId, date])` em `MetricSnapshot`; `@@unique([userId, platform, campaignId])` em `Campaign`; `@@unique([userId, phone])` em `LeadStatus`; `@@unique([userId, leadId])` em `TrackedLead`.
- `onDelete: Cascade` apropriado para wipe de tenant; `Affiliate.userId → SetNull` (correto para preservar histórico).

**🟡 Achados**
- **[Médio] Índices ausentes em FKs quentes:**
  - `Funnel(userId)` — consultado em `analytics/timeseries`.
  - `Account(userId)` — usado em lookups do NextAuth.
  - `FunnelStage(funnelId)` — cascade delete e lookups mais lentos.
- **[Médio] Índices compostos recomendados** para evitar full-scan conforme as tabelas crescem:
  - `FunnelEvent(funnelId, timestamp)` — `FunnelEvent` é a maior tabela.
  - `WebhookLog(userId, createdAt)` — hoje os índices são separados.

---

### ETAPA 8 — Performance  ·  **70/100**

**🟡 Achados**
- **[Médio] N+1 nos crons:**
  - `app/api/cron/snapshot/route.ts` — loop por **todos** os usuários com `funnelEvent.findMany` + `integration.findMany` por iteração (~2 queries × N usuários).
  - `app/api/cron/alerts/route.ts` — loop por usuário com `notification.findFirst` + `metricSnapshot.findMany` + `trackedLead.count`.
  - **Impacto:** aceitável hoje, escala mal (1.000 usuários ≈ 2.000+ queries/execução). **Correção:** `groupBy`/bulk fetch e processamento em memória.
- **[Médio] Full-scan potencial** em `analytics/timeseries` (`funnelEvent` por `funnelId`+`timestamp`) e `leads` (`webhookLog` por `userId`+`createdAt`) — resolvido com os índices compostos da Etapa 7.
- **Frontend:** Next.js App Router já faz code-splitting por rota; recomenda-se revisar `dynamic import` para componentes pesados (Recharts, export PDF).

---

### ETAPA 9 — Segurança Geral & Dependências  ·  **62/100**

**🔴 `npm audit`: 20 vulnerabilidades — 2 críticas, 7 altas, 10 moderadas, 1 baixa**

| Severidade | Pacote | Natureza | Onde impacta |
|---|---|---|---|
| 🔴 Crítico | `protobufjs` ≤7.5.7 | Execução arbitrária de código / DoS | via `@whiskeysockets/baileys` (WhatsApp) |
| 🔴 Crítico | `jspdf` ≤4.2.0 | Injeção de objeto PDF, execução de JS, DoS | `app/api/reports/export-pdf` |
| 🟠 Alto | `next` (faixa ampla) | Bypass de middleware/proxy (CWE-288), CSRF de Server Actions, SSRF, cache poisoning, XSS | **toda a app** — middleware faz o gating de auth |
| 🟠 Alto | `lodash` ≤4.17.23 | Code injection (`_.template`), prototype pollution | transitiva |
| 🟠 Alto | `minimatch`, `picomatch` | ReDoS / method injection | build/transitivas |
| 🟠 Alto | `flatted` ≤3.4.1 | DoS por recursão / prototype pollution | transitiva |
| 🟠 Alto | `@whiskeysockets/libsignal-node` | via protobufjs | WhatsApp |
| 🟡 Moderado | `dompurify` ≤3.3.3 | Múltiplos bypass de XSS | transitiva |
| 🟡 Moderado | `nodemailer` ≤8.0.4 | SMTP command injection | via `next-auth` |
| 🟡 Moderado | `postcss` <8.5.10 | XSS no stringify | build |
| 🟡 Moderado | `ws` 8.x | Memory disclosure | transitiva |
| 🟡 Moderado | `ajv`, `brace-expansion`, `svix`, `uuid`, `resend` | ReDoS / bounds / cadeia | dev/transitivas |

> ⚠️ **`next`** é o item mais sensível: a aplicação **depende do middleware para bloquear rotas não autenticadas e não verificadas** (`middleware.ts`). CVEs de *middleware/proxy bypass* (CWE-288) podem permitir contornar exatamente esse gating. **Atualizar o Next.js para a release estável corrigida é prioridade máxima.**

**Outros pontos**
- **CORS `*`** apenas nos endpoints públicos de tracking (`app/api/track/event`, `track/conversion`) — aceitável para pixel, mas ver poluição de dados na Etapa 2. As demais rotas não expõem CORS aberto.
- **✅ Cookies de sessão** do NextAuth: `httpOnly`, `secure` (prod), `sameSite=lax`. **✅ HTTPS/HSTS** ativos.
- **[Médio] JWT de 14 dias sem revogação server-side** — logout/troca de senha não invalida tokens já emitidos (limitação da estratégia `jwt` do NextAuth). Considerar `session: database` ou uma denylist de tokens para ações sensíveis.

**✅ Boas práticas de segurança encontradas**
- Secrets de integração **criptografados em repouso** com AES-256-GCM (`lib/security-utils.ts` — `encryptSecret/decryptSecret`).
- Senhas com **bcrypt custo 12** e **proteção contra timing-attack** no login (compare dummy quando usuário inexistente).
- **Enumeração protegida no login e no forgot-password** (mensagens genéricas + resposta constante).
- `getPublicBaseUrl` evita **Host header injection** preferindo `NEXTAUTH_URL`.

**🟡 [Médio] Enumeração de usuários remanescente**
- `app/api/auth/register` retorna `"Este email já está cadastrado"` → confirma existência da conta.
- `app/api/auth/check-email` (público) contribui para reconhecimento.
- **Correção:** mensagem genérica no registro + rate limit por IP nesses endpoints.

---

## 4. Plano de Correção

### 🚨 Imediato (24h) — Críticos
1. **Atualizar Next.js** para a versão estável mais recente corrigida (mitiga bypass de middleware/proxy, CSRF, SSRF) — **maior prioridade** por sustentar o gate de autenticação.
2. **Corrigir validação HMAC** para usar o **raw body** (`await request.text()`) em **todas** as rotas de webhook antes do `JSON.parse`.
3. **Substituir `jspdf`** por versão corrigida (ou isolar a geração de PDF) — execução de código no export de relatórios.
4. **Tratar a cadeia do Baileys** (`protobufjs`/`libsignal`): atualizar Baileys para versão que puxe protobufjs corrigido, ou isolar/limitar o módulo WhatsApp.

### ⏳ Prioritário (7 dias) — Altos
5. **Rate limiting distribuído** (Postgres/Redis) e cobertura de **login, registro e forgot-password**.
6. **Trilha de auditoria** (`AuditLog`) para login, senha, role, exclusão, pagamentos e integrações — com IP, tenant e resultado.
7. **Validação de timestamp anti-replay** nos webhooks que fornecem header de tempo.
8. **Atualizar dependências altas restantes** (`lodash`, `minimatch`, `picomatch`, `flatted`).
9. **Enumeração de usuários**: generalizar mensagem do registro + rate limit no `check-email`.

### 🧭 Estratégico (30 dias) — Médios/Baixos
10. **CSP** restritiva (com nonce) no `next.config.js`.
11. **Índices** ausentes/compostos: `Funnel(userId)`, `Account(userId)`, `FunnelStage(funnelId)`, `FunnelEvent(funnelId,timestamp)`, `WebhookLog(userId,createdAt)`.
12. **Refatorar crons** (`snapshot`, `alerts`) para eliminar N+1 (bulk/`groupBy`).
13. **Política de backup** documentada + **teste de restauração** (RPO ≤ 24h / RTO ≤ 4h).
14. **Revogação de sessão** server-side para ações sensíveis (ou `session: database`).
15. **Token de site** separado do `userId` para o pixel de tracking + reforço de rate limit por IP.
16. Atualizar moderadas (`dompurify`, `nodemailer`/next-auth, `postcss`, `ws`, `uuid`, `svix`, `resend`) conforme janelas de breaking change.

---

## 5. Conclusão

O FlowFunnel demonstra **arquitetura de segurança madura** nos pontos que mais importam para um SaaS multi-tenant: **isolamento de tenant sem IDOR**, **secrets criptografados**, **hashing forte de senhas** e **idempotência de pagamentos**. Os riscos concentram-se em **higiene de dependências** (atualização do Next.js e da cadeia jsPDF/Baileys é urgente), **autenticação de webhooks** (raw body + anti-replay) e **observabilidade/compliance** (rate limit distribuído + trilha de auditoria).

Executando o plano de 24h e 7 dias, o score geral projetado sobe de **68** para a faixa de **85–90/100**.
