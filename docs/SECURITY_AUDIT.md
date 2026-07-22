# Auditoria de Segurança — FlowFunnel SaaS

> Última revisão: 07/06/2026. Escopo: aplicação Next.js 16 (App Router), Prisma/PostgreSQL,
> NextAuth v4, Stripe + Mercado Pago. Idioma: pt-BR.

## Nota de segurança: **86 / 100**

A aplicação já estava fortemente endurecida antes desta passagem. Esta auditoria
confirmou as proteções existentes, corrigiu achados pontuais de risco real e
documentou as recomendações de maior porte que exigem decisão de produto antes de
serem implementadas.

---

## 1. Isolamento multi-tenant (PRIORIDADE MÁXIMA)

**Estado: Forte (com 1 correção aplicada).**

- Todas as queries de dados de tenant são escopadas por `userId` derivado da
  sessão (`getServerSession`), nunca de parâmetro do cliente. Prisma usa queries
  parametrizadas (sem SQL bruto / sem injeção).
- **Corrigido (IDOR):** `PATCH /api/integrations/whatsapp` (definir número padrão)
  fazia `update({ where: { id } })` sem checar dono. Agora valida posse via
  `findFirst({ id, userId })` e o `update` final é escopado por `userId`
  (defesa redundante). Antes, um usuário podia marcar como "padrão" a integração
  de outra conta passando um `integrationId` arbitrário.
- Rotas administrativas (`/admin/*`) exigem `role === 'ADMIN'`.

**Recomendação (sign-off necessário):** Row-Level Security (RLS) no Postgres com
`tenant_id` por linha como rede de segurança em profundidade. É uma mudança
estrutural (schema + policies + sessão de conexão com `SET app.tenant`) e deve ser
planejada como tarefa própria. Hoje o isolamento depende exclusivamente da camada
de aplicação — que está correta, mas RLS elimina a classe inteira de bugs por
query mal escopada.

## 2. Criptografia de credenciais

**Estado: Forte (com 1 correção aplicada).**

- `Integration.accessToken` / `refreshToken` são cifrados em repouso com
  AES-256-GCM (`lib/security-utils.ts`).
- **Corrigido (vazamento em resposta):** os handlers `POST` de
  `integrations/meta` e `integrations/whatsapp` devolviam o objeto `Integration`
  inteiro ao cliente — incluindo o token cifrado e, no caso do Meta, o `appSecret`
  em texto puro dentro do `config`. Agora passam por `safeIntegration()`
  (`lib/integration-sanitize.ts`), que remove tokens e chaves secretas do `config`
  (`appSecret`, `clientSecret`, `verifyToken`, etc.) e devolve apenas
  `hasAccessToken: boolean` + config não-sensível.

**Recomendação (sign-off necessário):** cifrar também o `appSecret` do Meta em
repouso (hoje fica em texto puro no JSON `config`). A correção acima já impede o
vazamento via API; cifrar em repouso é defesa adicional contra acesso direto ao banco.

## 3. Hashing de senha

**Estado: Bom.**

- bcrypt (`bcryptjs`) com custo 12 em registro, reset e troca de senha.
- **Recomendação (sign-off necessário):** migração para Argon2id. É segura, mas
  exige rehash transparente no login e adição de dependência — planejar como tarefa.

## 4. Política de senha forte

**Estado: Corrigido.**

- Antes: apenas `length >= 8`, e de forma inconsistente entre os endpoints.
- Agora: validador central `validatePasswordStrength()` (`lib/password.ts`) —
  mínimo 8, máximo 128, ao menos uma letra e um número — aplicado em
  `register`, `reset-password` e `account/password`.

## 5. Rate limiting

**Estado: Forte.**

- `checkRateLimit` persistido em Postgres (sobrevive a restart / multi-instância),
  aplicado em login, registro, forgot/reset de senha e rotas de pagamento
  (Stripe e Mercado Pago, por usuário e/ou IP).

## 6. Cabeçalhos de segurança

**Estado: Corrigido.**

- Antes: apenas Content-Security-Policy.
- Agora, via `withCsp()` em `middleware.ts`:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
  - `X-DNS-Prefetch-Control: off`
  - **Apenas em produção:** `Strict-Transport-Security` (HSTS, 2 anos,
    includeSubDomains, preload) e `X-Frame-Options: SAMEORIGIN`.
- HSTS e X-Frame-Options ficam restritos a produção de propósito: o preview do
  Replit roda em iframe cross-origin e o `X-Frame-Options: SAMEORIGIN` quebraria
  o preview em dev. Em dev o framing já é controlado pelo CSP `frame-ancestors`.

## 7. Validação de entrada

**Estado: Adequado.**

- Validações server-side presentes (e-mail, MX, e-mail descartável, campos
  obrigatórios, posse de recurso). `zod` está disponível para padronização
  incremental dos payloads — recomendado adotar progressivamente nas rotas que
  ainda validam manualmente.

## 8. Logs de auditoria

**Estado: Forte.**

- `lib/audit.ts` registra eventos com redação de segredos. Cobre login
  (sucesso/falha), `signIn`/`signOut` (eventos do NextAuth em `lib/auth.ts`),
  conexão/atualização de integrações, ações de pagamento, etc.

## 9. Webhooks

**Estado: Forte.**

- Assinatura HMAC obrigatória (fail-closed) quando o segredo está configurado
  (WhatsApp, Mercado Pago e plataformas em `lib/webhook-stages.ts`).
- Deduplicação de eventos persistida (Stripe e Mercado Pago) — idempotente,
  sobrevive a restart.

## 10. Separação de segredos

**Estado: Forte.**

- Chaves públicas vs. secretas corretamente separadas (Stripe / Mercado Pago);
  o access token do Mercado Pago nunca sai do backend. Segredos vivem no
  Replit Secrets, não em arquivos versionados.

---

## Recomendações pendentes (exigem decisão de produto / tarefa dedicada)

| # | Item | Risco mitigado | Esforço |
|---|------|----------------|---------|
| 1 | **RLS no Postgres + `tenant_id`** | Isolamento multi-tenant em profundidade | Alto |
| 2 | **2FA / TOTP** | Comprometimento de conta por senha vazada | Médio |
| 3 | **"Sair de todos os dispositivos"** (`tokenVersion`) | Sessões persistentes após troca de senha | Médio |
| 4 | **Migração Argon2id** | Endurecimento do hash de senha | Médio |
| 5 | **Cifrar `appSecret` do Meta em repouso** | Exposição via acesso direto ao banco | Baixo |
| 6 | **Padronizar validação com `zod`** | Consistência de validação de entrada | Baixo/Médio |

Os itens acima **não** foram implementados nesta passagem por serem estruturais,
destrutivos ou por exigirem mudança de fluxo do usuário — devem ser aprovados e
planejados individualmente.

## Correções aplicadas nesta passagem

1. IDOR em `PATCH /api/integrations/whatsapp` (escopo por `userId`).
2. Sanitização das respostas `POST` de integrações (Meta e WhatsApp) — fim do
   vazamento de tokens e `appSecret`.
3. Cabeçalhos de segurança (HSTS/X-Frame-Options em prod, nosniff, Referrer-Policy,
   Permissions-Policy, X-DNS-Prefetch-Control).
4. Política central de senha forte aplicada em registro, reset e troca de senha.
