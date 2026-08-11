# Arquitetura: Carteira Financeira de Afiliados — FlowSara

**Status:** projeto técnico para revisão. **Nada aqui foi implementado** — nenhum
model novo, nenhuma migration, nenhuma rota. Schema atual (`prisma/schema.prisma`)
não foi tocado.

**Escopo:** este documento trata o sistema de afiliados como um **sistema
financeiro interno**, não como uma feature de marketing. Regra fundamental que
guia todas as decisões abaixo: **o frontend nunca é fonte de verdade** para
saldo, comissão, status ou plano. A fonte de verdade é sempre banco de dados +
regras de backend + eventos financeiros verificáveis (webhooks assinados).

---

## 0. Por que redesenhar — evidência no código atual

Antes de propor a arquitetura nova, vale registrar o que motiva o redesenho:
não é só teoria, já existe uma exploração real hoje.

### 0.1 `affiliateId` confiado a partir do corpo da requisição (furto de comissão)

- **Stripe** — [`app/api/stripe/create-subscription/route.ts:92`](app/api/stripe/create-subscription/route.ts#L92):
  ```ts
  let resolvedAffiliateId: string | null = affiliateId || null
  ```
  Se `couponCode` não for enviado (ou não resolver para um afiliado), o
  `affiliateId` **enviado pelo cliente no `POST`** vai, sem nenhuma validação,
  para o metadata da assinatura Stripe — que é exatamente o campo que hoje
  alimentaria a atribuição de comissão.

- **Mercado Pago** — [`app/api/mercadopago/create-preference/route.ts:50-58`](app/api/mercadopago/create-preference/route.ts#L50):
  valida que o `affiliateId` existe e está ativo, mas **não verifica se aquele
  visitante foi de fato referenciado por esse afiliado**. Qualquer usuário
  autenticado pode declarar "fui indicado pelo afiliado X" para qualquer X
  ativo — e como `/api/affiliates/validate` agora é pública (correção da
  auditoria anterior), o keyspace de códigos/IDs de afiliado é consultável.

**Consequência prática:** hoje é possível um usuário (inclusive o próprio
afiliado, comprando por conta própria, ou terceiros) forjar a atribuição de
qualquer venda para um `affiliateId` à sua escolha. Isso não é uma falha
teórica — é o motivo pelo qual a Seção 18 (Atribuição) exige que o servidor
NUNCA aceite `affiliateId` do corpo da requisição como autoridade.

### 0.2 Mercado Pago tem a mesma falha, confirmada com outra evidência

Investiguei ponta a ponta o webhook do Mercado Pago
([`app/api/webhooks/mercadopago/route.ts:124-132`](app/api/webhooks/mercadopago/route.ts#L124)):

```ts
const externalRef = payment.external_reference
const refParts = externalRef.split(':')
const affiliateId = refParts[2] || null
```

O `affiliateId` que acaba sendo gravado como responsável pela venda vem
**literalmente de dentro da string `external_reference`**, que por sua vez foi
montada em [`create-preference/route.ts:94-95`](app/api/mercadopago/create-preference/route.ts#L94)
a partir do `affiliateId` que o **cliente** enviou no corpo da requisição de
criação da preferência (Seção 0.1). A assinatura HMAC do webhook (`x-signature`,
corretamente verificada) garante que o **pagamento** é legítimo — não que a
**atribuição de afiliado** embutida na referência é verdadeira. São duas
garantias diferentes, e hoje só a primeira existe.

**Conclusão:** a vulnerabilidade de atribuição não é específica da Stripe — é
estrutural, está nas duas integrações de pagamento, e a correção (Seção 18)
precisa cobrir as duas simetricamente.

### 0.3 `onDelete: Cascade` em dado financeiro

`Affiliate.sales` hoje cascade-deleta via `AffiliateSale.affiliate onDelete: Cascade`
([`schema.prisma:355`](prisma/schema.prisma#L355) relação inversa). Apagar um
`Affiliate` hoje apaga o histórico de vendas junto. Para um sistema financeiro,
isso é inaceitável — ver Seção 13.

### 0.4 `AffiliateSale.commissionAmount` como campo único, sem ciclo de vida

O model atual grava `commissionAmount` na própria venda, sem estado
(`PENDING`/`AVAILABLE`/pago), sem ledger, sem como reverter numa correção sem
sobrescrever o valor original. Não há como responder "esse afiliado já foi
pago por essa venda?" nem "o que aconteceu quando essa venda foi estornada?"
com o schema atual.

Esses quatro pontos justificam objetivamente o redesenho abaixo.

---

## 1. Modelo financeiro — visão geral

Arquitetura em **ledger imutável com saldo materializado**, seguindo o padrão
usado por sistemas de carteira/marketplace (Stripe Connect balance
transactions, contas correntes bancárias): toda movimentação de valor é um
registro append-only; o saldo é uma *view* cacheada desse histórico, nunca
editada diretamente.

### Models propostos (novos, além dos 3 que já existem)

| Model | Já existe? | Responsabilidade |
|---|---|---|
| `Affiliate` | ✅ existe | Identidade comercial do afiliado (código, % desconto, % comissão, status). **Nunca guarda saldo.** |
| `AffiliateClick` | ✅ existe | Telemetria de clique (baixa confiança, só analytics). **Nunca gera dinheiro sozinho.** |
| `AffiliateSale` | ✅ existe, redesenhar | Espelho **imutável** de um evento de pagamento real confirmado pela Stripe (venda inicial OU renovação). É o **fato**. |
| `AffiliateCommission` | 🆕 novo | A obrigação financeira derivada de uma `AffiliateSale`: quanto se deve, e em que estado (`PENDING → AVAILABLE → RESERVED → PAID_OUT`, ou `REVERSED`). É a **obrigação**, separada do fato. |
| `AffiliateLedgerEntry` | 🆕 novo | O ledger propriamente dito — cada linha é uma movimentação atômica e imutável entre contas virtuais (`PENDING`/`AVAILABLE`/`RESERVED`) da carteira de um afiliado. |
| `AffiliateWallet` | 🆕 novo | Saldo **materializado** por afiliado (`pendingBalance`, `availableBalance`, `reservedBalance`), sempre derivado do ledger — nunca a fonte de verdade, só um cache de performance. |
| `AffiliatePayout` | 🆕 novo | Uma solicitação/execução de saque, com máquina de estados própria. |
| `AffiliatePayoutItem` | 🆕 novo (join) | Liga um `AffiliatePayout` às `AffiliateCommission` que ele quita — necessário porque um saque agrega várias comissões. |

**Por que separar `AffiliateSale` de `AffiliateCommission`** em vez de manter
`commissionAmount` na própria venda (como é hoje): a venda é um **fato**
imutável ("recebemos R$X via Stripe, invoice Y"); a comissão é uma
**obrigação com ciclo de vida** (pode amadurecer, ser revertida, ser paga).
Misturar as duas força o model do fato a também carregar estado mutável, o
que quebra a garantia de imutabilidade do evento de origem.

**Modelos citados no pedido que decidi não criar:** nenhum além dos acima —
`AffiliateWallet` e `AffiliateLedgerEntry` cobrem exatamente o que se pediria
de um "ledger + saldo"; não há necessidade de um model adicional para isso.

---

## 2. Ledger — imutabilidade

### 2.1 A partida dobrada é realmente necessária na V1?

Reavaliando com mais rigor: **sim, e não é luxo — é o que torna as três
contas virtuais (`PENDING`/`AVAILABLE`/`RESERVED`) auditáveis como um sistema
único**, em vez de três contadores independentes que só coincidem por
disciplina de código.

A alternativa mais simples seria: uma linha por evento (ex.: só
`COMMISSION_ACCRUE +44,10`), e a "transferência" entre contas vira apenas uma
mudança de um campo `account` na mesma linha, sem par. O problema dessa
alternativa: perde-se a resposta à pergunta "quando exatamente esses R$44,10
deixaram de estar pendentes e passaram a estar disponíveis?" — sem uma segunda
linha marcando esse instante, a transição vira um `UPDATE` disfarçado (edita
o campo `account` da linha original), o que **viola diretamente a exigência do
pedido de que nenhuma linha histórica seja editada**. A partida dobrada é a
forma mais direta de representar "um evento com dois lados" sem tocar em
nenhuma linha já escrita.

**Custo real da partida dobrada:** cada transferência grava 2 linhas em vez de
1 — irrelevante em volume (o afiliado com maior movimento do produto ainda
gera poucas centenas de linhas por mês) — e cada `INSERT` duplo precisa estar
na mesma transação Prisma (já é o caso, ver Seção 8). **Não há trade-off real
que justifique simplificar isso na V1.**

### 2.2 As três contas virtuais, exatamente

Não são tabelas separadas — são um **valor no campo `account`** de
`AffiliateLedgerEntry`, e cada uma responde a uma pergunta de negócio
diferente:

| Conta | O que significa | Quem pode ver esse valor no dashboard do afiliado |
|---|---|---|
| `PENDING` | Comissão nasceu (`invoice.paid`/pagamento MP confirmado) mas ainda está na janela de retenção contra estorno. **Não sacável.** | Sim, como "em processamento" |
| `AVAILABLE` | Passou pela maturação. **Sacável.** | Sim, como "disponível para saque" |
| `RESERVED` | Está dentro de um `AffiliatePayout` em andamento (do `REQUESTED` até o `PAID`/`FAILED`/`CANCELLED`). Não pode ser gasta de novo enquanto esse payout não resolver. | Sim, implicitamente (não soma no "disponível", aparece como "em processamento de saque") |

O saldo total do afiliado (o que ele "tem", incluindo o que já pediu para
sacar) é sempre `pendingBalance + availableBalance + reservedBalance` —
nenhuma dessas três é a "verdade sozinha", são três estados do mesmo dinheiro.

### 2.3 Reconstrução do saldo a partir do ledger — confirmado

A garantia pedida é literal: a qualquer momento,

```sql
SELECT account, SUM(amount) FROM "AffiliateLedgerEntry"
WHERE "affiliateId" = $1 GROUP BY account
```

deve produzir exatamente `AffiliateWallet.pendingBalance`,
`.availableBalance`, `.reservedBalance` para aquele afiliado. Essa é a
consulta usada tanto pelo job de reconciliação (Seção 3) quanto por qualquer
auditoria futura — o ledger não é só o histórico, é a **prova** de que o
saldo materializado está correto.

### 2.4 Estilo de linha

Cada movimento relevante (maturação, reserva de saque, liberação, liquidação)
é representado por **duas linhas** de ledger que compartilham um
`transferGroupId`: uma linha negativa (débito da conta de origem) e uma
positiva (crédito da conta de destino). Isso torna a reconciliação trivial —
`SUM(amount)` dentro de um `transferGroupId` deve ser sempre zero — e é o
mesmo princípio usado por sistemas de contabilidade auditável.

Exceção de propósito: `COMMISSION_ACCRUE` (nascimento da comissão) e
`PAYOUT_SETTLE` (liquidação final, dinheiro sai de verdade) são linhas
**únicas**, sem par — porque não são uma transferência *entre* contas do
afiliado, são a fronteira entre "o dinheiro não existia na carteira" e "o
dinheiro existe" (ou deixou de existir).

```
AffiliateLedgerEntry
  id              String   @id @default(cuid())
  affiliateId     String
  account         Account  // PENDING | AVAILABLE | RESERVED
  amount          Decimal  @db.Decimal(12,2)  // + crédito, - débito
  type            LedgerEntryType
  transferGroupId String?  // agrupa as 2 linhas de uma transferência
  referenceType   String?  // "AffiliateCommission" | "AffiliatePayout" | "AdminAction"
  referenceId     String?
  idempotencyKey  String   @unique
  reason          String?  // obrigatório em ADJUSTMENT e REVERSE
  createdBy       String?  // adminId, nulo = automático/sistema
  createdAt       DateTime @default(now())

  @@index([affiliateId, createdAt])
  @@index([referenceType, referenceId])
```

`LedgerEntryType`: `COMMISSION_ACCRUE`, `COMMISSION_MATURE`,
`COMMISSION_REVERSE`, `PAYOUT_RESERVE`, `PAYOUT_RELEASE`, `PAYOUT_SETTLE`,
`ADJUSTMENT`.

### 2.5 Confirmação explícita dos pontos pedidos

- ✅ Registros financeiros históricos **não podem ser `UPDATE`** — nenhuma rota,
  nenhum admin, nenhum job jamais chama `.update()` em `AffiliateLedgerEntry`.
- ✅ Registros financeiros históricos **não podem ser `DELETE`** — idem, e
  reforçado por `REVOKE` (abaixo).
- ✅ Correções são novas entradas (`ADJUSTMENT`, referenciando a linha original
  via `referenceType`/`referenceId`).
- ✅ Reversões são novas entradas (`COMMISSION_REVERSE`, mesma referência).
- ✅ Cada entrada tem `idempotencyKey` único (Seção 6, tabela completa) e
  `referenceType`/`referenceId` apontando para o que originou o movimento.
- ✅ O saldo é inteiramente reconstruível a partir do ledger (Seção 2.3).

### 2.6 Como garantir imutabilidade no Postgres/Prisma

1. **Nunca chamar `.update()` ou `.delete()`** nesse model em nenhum lugar do
   código — correção é sempre uma nova linha (`COMMISSION_REVERSE` ou
   `ADJUSTMENT`), nunca uma edição da linha original. Isso é disciplina de
   código, reforçada por code review.
2. **Backstop no banco:** `REVOKE UPDATE, DELETE ON "AffiliateLedgerEntry"
   FROM app_rls;` na role usada pelo client `prisma` (RLS) — a mesma técnica
   de roles já usada neste projeto (`lib/prisma.ts`, migration
   `20260607000000_enable_rls`). **Limite honesto:** se a role usada por
   `prismaAdmin`/`DATABASE_URL` for um superuser real do Postgres, REVOKE não
   a afeta — superusers ignoram grants. Essa garantia protege contra bug/abuso
   em **código de aplicação**, não contra um operador com acesso root ao
   banco (isso é um limite operacional, não de código — ver Seção 15).
3. **Sem coluna `updatedAt`** no model — reforça na própria forma dos dados
   que não existe conceito de "editar depois".

---

## 3. Saldo — materializado, nunca calculado no frontend

**Decisão: opção (B) — saldo materializado + ledger como fonte de verdade.**
Calcular via `SUM()` do ledger a cada leitura não escala (histórico cresce
indefinidamente) e o produto já expõe saldo em dashboards de alta frequência
(mesmo padrão de `MetricSnapshot` já existente no projeto). O ledger continua
sendo a fonte de verdade; `AffiliateWallet` é só a *view* materializada dele.

```
AffiliateWallet
  affiliateId     String   @id
  pendingBalance  Decimal  @db.Decimal(12,2) @default(0)
  availableBalance Decimal @db.Decimal(12,2) @default(0)
  reservedBalance Decimal  @db.Decimal(12,2) @default(0)
  lifetimeEarned  Decimal  @db.Decimal(12,2) @default(0)
  lifetimePaid    Decimal  @db.Decimal(12,2) @default(0)
  updatedAt       DateTime @updatedAt
```

### Como garantir que nunca diverge do ledger

Apresento duas opções — recomendo a (B) para a v1, e explico por quê.

**Opção A — trigger de banco + `REVOKE UPDATE` nas colunas de saldo.**
Máxima integridade estrutural: nenhum código de aplicação, nem um bug,
consegue mudar o saldo sem passar por um `INSERT` no ledger, porque a coluna
literalmente não é editável pela role da aplicação — só o trigger (que roda
como dono da tabela) pode escrevê-la. **Ressalva técnica que descobri
revisando isso:** `SELECT ... FOR UPDATE` (necessário para travar a linha em
operações concorrentes, Seção 8) exige privilégio de `UPDATE` no Postgres —
então um `REVOKE UPDATE` total quebraria o próprio mecanismo de lock. Viável
com `GRANT UPDATE` em nível de coluna (Postgres suporta), mas isso é lógica de
permissão adicional em SQL bruto (mesmo padrão já usado na migration de RLS)
que precisa ser testada com cuidado.

**Opção B — disciplina de código: uma única função de gravação.**
Todas as colunas de saldo continuam graváveis pela aplicação, mas **um único
módulo** (`lib/affiliate-ledger.ts`, proposto) é o **único lugar no código**
autorizado a escrever tanto no ledger quanto no wallet — sempre dentro da
mesma transação Prisma. Nenhuma rota chama `prisma.affiliateWallet.update()`
diretamente; todas chamam funções de domínio (`accrueCommission()`,
`reservePayout()`, etc.) que internamente passam por esse módulo. Mais simples
de construir e testar corretamente agora; a garantia vem de superfície de
código estreita + testes automatizados (Seção 21), não de permissão de banco.

**Recomendo (B) para o lançamento** — é o padrão que este projeto já usa com
sucesso (`withTenantTx`, `checkRateLimit` centralizados) — e revisitar (A)
depois, se o volume/risco justificar o investimento em privilégios de coluna.
**Isso é uma decisão para confirmar com você.**

Como defesa adicional em qualquer das opções: um **job de reconciliação**
(cron noturno, mesmo padrão de `app/api/cron/snapshot`) que recalcula
`SUM(ledger)` por afiliado e compara com `AffiliateWallet`, alertando (nunca
corrigindo automaticamente) qualquer divergência.

### 3.1 Estratégia explícita por operação

| Operação | O que acontece com o Wallet |
|---|---|
| **Criação** | `AffiliateWallet` é criado com todos os saldos zerados no mesmo instante em que `Affiliate` é criado (não é criado sob demanda na primeira comissão — evita checar "existe wallet?" em todo lugar que grava ledger). |
| **Atualização** | Nunca via `UPDATE` solto. Sempre: inserir linha(s) de ledger **e** atualizar o(s) contador(es) correspondente(s) do wallet **na mesma transação Prisma** (`withTenantTx`), via a função central `appendLedgerEntry()` (Seção 3, Opção B). |
| **Reversão** | Mesma regra da atualização — a reversão em si já É uma escrita de ledger + wallet, não um caso especial. |
| **Concorrência** | Ver Seção 8 — o `UPDATE` atômico condicional cobre exatamente o caso de wallet sob disputa. |
| **Recuperação após falha** | Como o `INSERT` no ledger e o `UPDATE` no wallet estão na **mesma transação Postgres**, uma falha no meio do caminho (processo derrubado, timeout) faz o Postgres reverter a transação inteira — não existe estado intermediário "ledger gravado mas wallet não atualizado" persistido no banco. Se a falha for do lado da aplicação **depois** do commit (ex.: erro ao responder o cliente), o cliente reenvia com a mesma `idempotencyKey` (Seção 6) e recebe o mesmo resultado já commitado, sem duplicar. |
| **Reconciliação** | Job noturno (`cron/affiliate-reconcile`, proposto, mesmo padrão `CRON_SECRET` de `cron/snapshot`) recalcula `SUM(ledger)` por afiliado e por conta, compara com o wallet materializado, e **só alerta** (Slack/e-mail admin) em caso de divergência — nunca corrige sozinho, porque uma correção automática num sistema financeiro pode mascarar um bug real em vez de expô-lo. |

---

## 4. Ciclo de comissão — fluxo completo

### 4.0 Investigação do código real (item 3 do pedido)

Verifiquei, não assumi. Três achados:

1. **"Fundador R$297 vitalício" (citado no README) não existe no código.**
   Busquei por `Fundador`/`vitalício`/`lifetime` em `app/` e `lib/` — zero
   ocorrências fora do texto do README, que é cópia de marketing desatualizada
   de uma fase anterior do produto. Os planos reais hoje são `FREE / START /
   PRO / SCALE` (`lib/plans.ts`), todos recorrentes mensais.

2. **100% do código Stripe usa `mode: 'subscription'`.** Busquei
   `mode: 'payment'` (pagamento único) em `app/api/stripe/` — zero
   ocorrências. As quatro rotas que criam cobrança
   (`checkout`, `embedded-checkout`, `create-subscription`, `create-trial`)
   usam `mode: 'subscription'` ou `stripe.subscriptions.create` diretamente.
   **Conclusão: não existe hoje nenhum produto Stripe deste projeto que
   `invoice.paid` deixe de cobrir.** O gatilho único descrito abaixo é válido
   para 100% da superfície Stripe atual — não é uma suposição, é verificado.

3. **Mercado Pago não tem assinatura nativa neste projeto.** Busquei
   `subscription`/`preapproval`/`recurring` em `lib/mercadopago.ts` e nas
   rotas de MP — zero ocorrências de API de assinatura da própria Mercado
   Pago. Cada compra é um **pagamento único** (`payment.approved`); o campo
   `User.subscriptionStatus` é inteiramente gerido pela aplicação
   ([`webhooks/mercadopago/route.ts:176-179`](app/api/webhooks/mercadopago/route.ts#L176)),
   não pela Mercado Pago. **Isso significa que "renovação" para um cliente
   pago via Mercado Pago não existe como conceito de billing automático — é
   o cliente refazendo o checkout manualmente a cada ciclo** (ou a aplicação
   tem algum outro mecanismo de cobrança recorrente fora do que audita aqui —
   **isso precisa ser confirmado com você**, porque muda a expectativa de
   receita recorrente via MP).

Essa terceira descoberta muda a arquitetura: não existe um gatilho único
entre os dois processadores — existem **dois gatilhos paralelos**, cada um
com seu formato de evento, alimentando a **mesma** função de domínio de
criação de comissão.

### 4.1 Gatilho Stripe: `invoice.paid`

Usar **exclusivamente `invoice.paid`** como gatilho — para venda inicial *e*
renovação, sem tratamento especial para cada caso.

**Por que não `checkout.session.completed`:** esse evento pode disparar antes
do pagamento compensar de fato (Boleto/Pix são assíncronos — a sessão
"completa" mas o dinheiro ainda não chegou). `invoice.paid` é a prova de que o
valor foi efetivamente capturado, e cobre igualmente a cobrança inicial e cada
renovação (Stripe fatura assinaturas via invoice mesmo no primeiro ciclo).

```
Stripe invoice.paid (assinado, deduplicado via claimStripeEvent existente)
  → subscription.customer → User
  → User.referredByAffiliateId (atribuição DURÁVEL, gravada uma única vez — Seção 18)
      → null?  → não é venda de afiliado, encerra
      → self-referral (affiliate.userId === user.id)? → bloqueia, loga sinal de fraude, encerra
  → idempotência: já existe AffiliateSale para este invoice.id? → se sim, no-op
  → cria AffiliateSale (fato imutável: valor, invoice, subscription, tipo INITIAL|RENEWAL, processor=STRIPE)
  → calcula commission = round(sale.discountedAmount * affiliate.commissionPercent / 100, 2)  [ROUND_HALF_UP]
  → cria AffiliateCommission (status PENDING)
  → emite AffiliateLedgerEntry (COMMISSION_ACCRUE, +amount, conta PENDING)
```

### 4.2 Gatilho Mercado Pago: `payment.approved`, sem conceito de renovação automática

Mesma função de domínio (`createCommissionFromPayment()`, proposta), chamada
a partir de um gatilho estruturalmente diferente:

```
MP webhook payment.approved (assinatura x-signature já verificada, dedup via claimMercadoPagoEvent existente)
  → getPayment(paymentId) da API do MP (re-consulta, não confia só no payload — já é o padrão atual)
  → payment.external_reference → userRef, planKey  (NUNCA affiliateId — ver Seção 18)
  → User.referredByAffiliateId (mesma atribuição durável usada pelo lado Stripe)
      → null? / self-referral? → mesmas regras da Seção 4.1
  → idempotência: já existe AffiliateSale para este payment.id? → se sim, no-op
  → cria AffiliateSale (processor=MERCADOPAGO, tipo INITIAL — MP não gera RENEWAL automático, ver 4.0.3)
  → mesmo cálculo de comissão, mesma criação de AffiliateCommission + ledger
```

**Diferença estrutural que precisa ficar explícita:** cada pagamento MP é
independente — não há "invoice de renovação" que o sistema receba
passivamente. Se o negócio espera receita recorrente via Mercado Pago, isso
depende de o cliente re-comprar manualmente (ou de um mecanismo de cobrança
recorrente que não encontrei no código auditado — **item para você
confirmar**, não uma lacuna deste desenho).

### 4.3 Maturação (retenção antes de ficar sacável)

Job agendado (mesmo padrão de `cron/alerts`, protegido por `CRON_SECRET`)
promove `PENDING → AVAILABLE` após uma janela de retenção (proposta: **15
dias** — a definir) — protege contra estorno/chargeback nos primeiros dias
após a conversão. Emite `COMMISSION_MATURE` (transferência PENDING→AVAILABLE,
duas linhas). Idêntico para comissões de origem Stripe ou Mercado Pago.

### 4.4 Casos especiais, por processador

| Evento | Stripe | Mercado Pago |
|---|---|---|
| Cancelamento | `customer.subscription.deleted` — não reverte comissões passadas, só impede `invoice.paid` futuros | N/A (não há assinatura para cancelar — Seção 4.0.3) |
| Pagamento falhou | `invoice.payment_failed` — nenhuma ação, comissão nunca nasceu | `payment.rejected`/status diferente de `approved` — idem, nenhuma ação |
| Reembolso total | `charge.refunded` (`refunded: true`) → `COMMISSION_REVERSE` completo | Status do pagamento muda para `refunded` no MP → mesmo tratamento |
| Reembolso parcial | `charge.refunded` parcial → reversão proporcional (ver 4.5, opção a confirmar) | MP suporta reembolso parcial via API — mesmo tratamento proporcional |
| Chargeback | `charge.dispute.created` — hoje **nem tratado** no webhook de billing (achado já corrigido nesta auditoria para o plano do usuário; aqui a comissão escuta o mesmo handler) | **Confirmado agora, não presumido:** [`webhooks/mercadopago/route.ts:176-227`](app/api/webhooks/mercadopago/route.ts#L176) só trata `payment.status === 'approved'` e `'cancelled'/'refunded'`. O status de contestação da Mercado Pago (`charged_back`) **não está em nenhum dos dois branches** — hoje um chargeback via MP não rebaixa plano nem reverteria comissão. **Achado novo desta revisão**, fora do escopo desta auditoria de billing original mas com o mesmo padrão de correção já aplicado ao lado Stripe: adicionar o branch `charged_back` ao webhook. |
| Upgrade/downgrade | Cada invoice de proration tem seu próprio `amountPaid` real — funciona sem lógica especial | N/A (sem proration automática sem assinatura nativa) |

### 4.5 Comparação de opções para saldo negativo após clawback tardio — sem escolher

Cenário: comissão já `RESERVED` (payout em andamento) ou `PAID_OUT` (Pix já
enviado, irreversível), e chega um reembolso/chargeback depois disso.

| Opção | Como funciona | Impacto no ledger/wallet | Prós | Contras |
|---|---|---|---|---|
| **A. Saldo negativo livre** | `COMMISSION_REVERSE` debita `availableBalance` sem piso — pode ficar negativo indefinidamente | `AffiliateWallet.availableBalance` passa a aceitar valores `< 0`; `CHECK` constraint removida dessa coluna especificamente | Simples de implementar; reflete a realidade financeira exata (o afiliado deve dinheiro) | Sem qualquer limite, um afiliado pode acumular dívida grande sem nunca sacar de novo — a dívida "trava" mas não força ação |
| **B. Obrigação/dívida separada** | Reversão não mexe em `availableBalance` diretamente — cria um registro `AffiliateDebt` (model novo) que precisa ser quitado explicitamente antes de qualquer saque futuro | Mais um model, mais uma tabela para reconciliar; ledger continua tendo a entrada de reversão, mas o "efeito" mora em outro lugar | Separa claramente "ganhos" de "dívidas", mais fácil de reportar para o afiliado | Mais complexidade de schema; risco de a dívida e o ledger divergirem se a lógica de quitação tiver bug |
| **C. Compensação automática com comissões futuras** | `availableBalance` fica negativo (como A), e toda nova `COMMISSION_MATURE` futura primeiro abate o negativo antes de ficar sacável | Nenhuma mudança de schema além de A — é uma **regra de negócio** aplicada no momento da maturação, não uma estrutura de dados nova | Resolve a dívida organicamente, sem ação manual | Se o afiliado parar de gerar vendas novas, a dívida nunca se paga sozinha — precisa de A ou B como base de qualquer forma |
| **D. Bloquear payouts futuros até quitação** | Além de A/B/C, `AffiliatePayout.REQUESTED` é recusado enquanto `availableBalance < 0`, mesmo que uma parte do saldo pareça "disponível" | Regra de validação na criação do payout, não muda schema | Impede que o afiliado saque enquanto deve, protegendo o caixa da empresa | Pode ser visto como punitivo se a dívida for pequena comparada ao saldo disponível — depende de política |
| **E. Combinação (A + C + D)** | Saldo pode ficar negativo (A), é compensado automaticamente por comissões futuras (C), e novos saques ficam bloqueados enquanto negativo (D) | Só a mudança de schema de A (remover `CHECK >= 0` de `availableBalance` especificamente) | Cobertura mais completa, sem precisar do model extra de B | Mais regras de negócio para testar (Seção 21 precisaria de casos extras) |

**Não estou escolhendo por você — Seção 22-B trata isso como decisão de
negócio.** Recomendação técnica, se ajudar a decidir: **E** é a que menos
schema novo exige (reaproveita a estrutura de A) e cobre o ciclo completo
(dívida → compensação → proteção), mas o "certo" aqui depende de quão comum
vocês esperam que chargeback tardio seja em afiliados — se for raro,
overhead de B pode não valer a pena; se for frequente, B dá visibilidade mais
clara para conversas com o afiliado.

Independente da opção escolhida, o passo abaixo é comum a todas:

> Gera alerta administrativo (`AuditLog` + notificação) para revisão humana —
> dinheiro que já saiu via Pix não tem estorno automático. **Isso é processo
> operacional, não algoritmo.**

---

## 5. Comissão recorrente

**Via Stripe:** já coberto no fluxo da Seção 4.1 — cada renovação é um
`invoice.paid` independente, que gera sua **própria** `AffiliateSale` +
`AffiliateCommission`. A atribuição não é reavaliada a cada renovação a partir
de cliques — é lida do campo **durável** `User.referredByAffiliateId`, gravado
uma única vez no momento da primeira conversão (Seção 18). Isso é essencial:
numa renovação automática não existe navegador, não existe cookie, não existe
requisição HTTP do visitante — só o evento de billing.

**Via Mercado Pago:** conforme a Seção 4.0.3/4.2, **não existe renovação
automática de billing hoje** — cada `payment.approved` é um evento
independente, iniciado por uma nova ação de checkout (do cliente ou de algum
mecanismo externo não auditado aqui). Do ponto de vista da comissão isso não
muda nada estruturalmente (a mesma função `createCommissionFromPayment()`
roda, lendo a mesma atribuição durável) — só muda a **origem**: não há
conceito de "assinatura" MP disparando sozinha, então cada pagamento MP
comissionável exige um evento de pagamento real, nunca um agendamento
interno do FlowSara. **Isso reforça, não enfraquece, a regra abaixo.**

Confirma explicitamente a regra do pedido: **nenhuma comissão nasce só porque
existe um `AffiliateClick`** — o clique é telemetria; o gatilho financeiro é
sempre um evento de pagamento confirmado (`invoice.paid` na Stripe,
`payment.approved` no Mercado Pago) com atribuição durável já resolvida.

---

## 6. Idempotência

Uma chave por tipo de evento, e a constraint de banco que a torna real (não
só uma convenção de nome):

| Evento | Chave idempotente | Constraint no banco |
|---|---|---|
| Stripe event (transporte) | `event.id` (nativo Stripe) | `StripeProcessedEvent.eventId @unique` — **já existe**, `lib/stripe-dedup.ts` |
| Stripe invoice (domínio) | `invoice.id` | `AffiliateSale.stripeInvoiceId @unique` — novo |
| Mercado Pago payment (transporte) | `` `${payment.id}:${payment.status}` `` | `MercadoPagoProcessedEvent` — **já existe** (`claimMercadoPagoEvent`), mesma chave composta já em uso hoje |
| Mercado Pago payment (domínio) | `payment.id` | `AffiliateSale.mercadoPagoPaymentId @unique` — novo |
| `AffiliateSale` (unificado) | um dos dois acima, conforme `processor` | `@@unique([processor, externalPaymentId])` — desenho único cobrindo os dois processadores em vez de duas colunas nullable separadas (mais limpo que `stripeInvoiceId`/`mercadoPagoPaymentId` como colunas distintas — reavaliei e prefiro esta forma) |
| `AffiliateCommission` | `saleId` (1:1 com a venda) | `AffiliateCommission.saleId @unique` — novo |
| Reversão (`COMMISSION_REVERSE`) | `` `reverse:${processor}:${refundOrDisputeObjectId}` `` — **precisão importante (revisão adversarial, item 13):** o id usado é o do **objeto** de reembolso/disputa (`refund.id`/`dispute.id` na Stripe, id da devolução no MP), **não** o `event.id` do webhook. O `event.id` já é deduplicado numa camada anterior (`claimStripeEvent`); usar o mesmo id aqui seria redundante. Usar o id do objeto garante que dois reembolsos parciais **distintos** sobre a mesma cobrança (dois `refund.id` diferentes) gerem duas reversões corretas, enquanto o mesmo reembolso reentregue via retry de webhook (mesmo `refund.id`, `event.id` novo) não duplica. | `AffiliateLedgerEntry.idempotencyKey @unique` — novo. |
| Maturação (`COMMISSION_MATURE`) | `` `mature:${commissionId}` `` | mesma coluna `idempotencyKey` — o job de maturação não pode amadurecer a mesma comissão duas vezes mesmo se rodar em paralelo por engano |
| Payout — criação | `Idempotency-Key` gerada pelo cliente uma vez, reenviada em retry | `AffiliatePayout.@@unique([affiliateId, idempotencyKey])` — novo |
| Payout — reserva de saldo (`PAYOUT_RESERVE`) | `` `payout-reserve:${payoutId}` `` | `idempotencyKey` do ledger |
| Payout — liquidação (`PAYOUT_SETTLE`) | `` `payout-settle:${payoutId}` `` | idem — admin não consegue clicar "confirmar pago" duas vezes e debitar duas vezes |
| Ajuste manual (`ADJUSTMENT`) | Gerado pelo servidor no momento da criação (`adjustment:${cuid}`) — não precisa ser determinístico, porque cada ajuste é uma ação humana distinta por definição | `idempotencyKey` do ledger, ainda único, mas serve só para impedir duplo-clique no botão "salvar ajuste" (reenvio com o mesmo `cuid` gerado no frontend uma vez) |

**Importante — isto é diferente de concorrência (Seção 8):** idempotência
protege contra a **mesma** requisição lógica sendo repetida (retry, duplo
clique); concorrência protege contra **duas requisições diferentes e
legítimas** competindo pelo mesmo saldo ao mesmo tempo. Os dois mecanismos são
necessários e resolvem problemas diferentes — nenhum substitui o outro.

---

## 7. Payout — máquina de estados

```
REQUESTED → UNDER_REVIEW → APPROVED → PROCESSING → PAID
    │             │             │
    └─────────────┴─────────────┴──→ CANCELLED (afiliado ou admin, antes de PROCESSING)
                                 └──→ FAILED (admin, após tentativa mal-sucedida) → volta pro afiliado poder solicitar de novo
                  └──→ REJECTED (admin, ex.: suspeita de fraude)
```

Regras de transição (tabela explícita de estados permitidos, validada em
código — qualquer transição fora dela é rejeitada e logada como sinal de
segurança):

| Transição | Quem aciona | Efeito no ledger |
|---|---|---|
| `— → REQUESTED` | **Só o afiliado**, sobre a própria carteira | `PAYOUT_RESERVE` (AVAILABLE→RESERVED), atômico com a criação do payout (Seção 8/9) |
| `REQUESTED → UNDER_REVIEW` | Admin | nenhum (fundos já reservados) |
| `UNDER_REVIEW/REQUESTED → APPROVED` | Admin | nenhum |
| `APPROVED → PROCESSING` | Admin | nenhum |
| `PROCESSING → PAID` | Admin (confirma Pix enviado) | `PAYOUT_SETTLE` — débito final de RESERVED, comissões associadas → `PAID_OUT` |
| `REQUESTED/UNDER_REVIEW/APPROVED → CANCELLED` | Afiliado (autoatendimento) ou admin | `PAYOUT_RELEASE` (RESERVED→AVAILABLE) |
| `PROCESSING → FAILED` | Admin | `PAYOUT_RELEASE` (RESERVED→AVAILABLE) |
| `REQUESTED/UNDER_REVIEW → REJECTED` | Admin | `PAYOUT_RELEASE` (RESERVED→AVAILABLE) + flag para revisão de fraude |

**"O afiliado não pode mudar o status"** é garantido por desenho de rota, não
por checagem de campo: a API do afiliado expõe **apenas** `POST
/payout` (cria `REQUESTED`) e `POST /payout/:id/cancel` — nunca um endpoint
genérico que aceite `{ status }` no corpo. Toda transição administrativa é um
**endpoint com verbo específico** (`/approve`, `/reject`, `/mark-paid`...),
não um `PATCH` genérico — isso elimina estruturalmente a classe de ataque
"frontend manda o status que quiser" (ver Seção 15).

---

## 8. Concorrência — o ponto crítico

### Cenário do pedido: saldo R$100, dois saques simultâneos de R$100

**Mecanismo: `UPDATE` atômico condicional** (não `SELECT` seguido de `IF`
em código de aplicação):

```sql
UPDATE "AffiliateWallet"
SET "availableBalance" = "availableBalance" - $amount,
    "reservedBalance"  = "reservedBalance" + $amount
WHERE "affiliateId" = $affiliateId
  AND "availableBalance" >= $amount
RETURNING *;
```

Por que isso resolve a corrida: o Postgres garante que o par
"ler-o-valor-atual → decidir → escrever" dentro de um único `UPDATE` é atômico
em nível de linha (MVCC + lock de escrita). A **segunda** transação
concorrente para o **mesmo `affiliateId`** bloqueia automaticamente até a
primeira commitar, e só então reavalia o `WHERE` contra o valor **já
atualizado** pela primeira. Se a primeira zerou o saldo, a segunda:

```
0 linhas afetadas (RETURNING vazio) → rejeitar com "saldo insuficiente"
```

Isso é executado dentro de `withTenantTx` (helper **já existente** em
`lib/prisma.ts`, e já usado nesta sessão para corrigir exatamente esse tipo de
corrida nos limites de funil/workspace/WhatsApp) — o `UPDATE`, o `INSERT` do
`AffiliatePayout` e as duas linhas de `AffiliateLedgerEntry`
(`PAYOUT_RESERVE`) acontecem na mesma transação.

**Explicitamente rejeitado:** o padrão
```ts
if (balance >= amount) { create(payout) }  // NUNCA — não atômico, corrida real
```

### Backstop estrutural

`CHECK ("reservedBalance" >= 0)` como constraint de banco incondicional —
nunca deve haver um caminho legítimo (nem um bug) que reserve mais do que
existe. (Note que `availableBalance` **pode** ficar negativo por reversão de
comissão — Seção 4/13 — então essa constraint específica não se aplica a ela.)

---

## 9. Requisição de saque

O corpo da requisição pode enviar `{ amount, idempotencyKey }` — **o `amount`
nunca é tratado como "quanto está disponível"**, só como "quanto o afiliado
*deseja* sacar", validado contra o saldo real dentro do mesmo `UPDATE` atômico
da Seção 8. Se disponível = R$327,40 e o corpo pedir R$500, o `WHERE
availableBalance >= 500` não bate, zero linhas afetadas, rejeitado — não
importa o que DevTools/JS/curl manipulem, porque a verdade nunca saiu do
banco.

Validações adicionais no limite da API (defesa em profundidade, não a
proteção principal):
- `amount > 0`, no máximo 2 casas decimais;
- valor mínimo de saque (proposta: a definir — Seção 22-B);
- `affiliateId` **nunca** vem do corpo — é sempre resolvido de
  `Affiliate.findFirst({ where: { userId: session.user.id } })`, o mesmo
  padrão de ownership-by-session já usado em todo o resto do projeto.

---

## 10 e 11. Roles

`role` (`PRODUTOR`/`ADMIN`) em `User` e "ser afiliado" são **dimensões
independentes** — um `PRODUTOR` comum pode também ser afiliado
(`Affiliate.userId` já existe como FK opcional). Autorização de rota de
carteira não olha `role`; olha posse: `Affiliate.userId === session.user.id`.

### O que o afiliado pode

- `GET /api/affiliate/wallet` — próprio saldo
- `GET /api/affiliate/wallet/ledger` — próprio histórico (paginado, escopado
  por `session.user.id` no servidor, nunca por parâmetro do cliente)
- `POST /api/affiliate/wallet/payout` — solicitar saque
- `POST /api/affiliate/wallet/payout/:id/cancel` — cancelar o **próprio**
  saque, só se ainda cancelável

### O que o afiliado nunca pode (garantido por a rota simplesmente não existir)

Alterar comissão, saldo, status de payout, percentual, associar venda
manualmente, definir cliente indicado — nenhuma dessas ações tem um endpoint
correspondente no lado do afiliado.

### Admin (reaproveita `requireAdmin()` já existente e auditado)

`GET /api/admin/affiliates`, `GET /api/admin/affiliates/:id/ledger`, `POST
/api/admin/affiliates/:id/adjust` (cria `ADJUSTMENT`, `reason` obrigatório),
`POST /api/admin/affiliates/:id/block`, `GET /api/admin/payouts`, `POST
/api/admin/payouts/:id/{approve|reject|mark-processing|mark-paid|mark-failed}`.

Mesmo admin **não edita registro financeiro histórico** — um ajuste é sempre
uma nova linha de ledger (`ADJUSTMENT`) referenciando a linha original, nunca
um `UPDATE` na linha original.

---

## 12. Auditoria

Reaproveita a infraestrutura **já existente** (`AuditLog` model + `lib/audit.ts
logAudit()`), estendendo com `action` namespaced: `affiliate.wallet.payout_requested`,
`affiliate.wallet.payout_approved`, `affiliate.wallet.payout_paid`,
`affiliate.commission.reversed`, `affiliate.commission.adjusted`,
`affiliate.blocked`. Metadata inclui valores, IDs de referência, motivo — nunca
segredo ou dado desnecessário (mesma convenção de `sanitizeForLog` já em uso).

---

## 13. Banco — constraints

### 13.1 Inventário completo de campos `Float` no schema (item 4 do pedido)

Varri o `schema.prisma` inteiro — todo campo `Float`, não só os de afiliado —
e classifiquei cada um. **Nada aqui foi alterado ainda**, é só o
levantamento pedido:

| Model.Campo | Representa dinheiro? | Escopo deste projeto |
|---|---|---|
| `AffiliateSale.originalAmount` | Sim — valor cobrado antes do desconto | ✅ **Migrar** — é a base de cálculo da comissão |
| `AffiliateSale.discountedAmount` | Sim — valor efetivamente pago | ✅ **Migrar** — usado direto na fórmula de comissão |
| `AffiliateSale.commissionAmount` | Sim (será substituído por `AffiliateCommission.amount`) | ✅ **Migrar** (no novo model) |
| `Affiliate.discountPercent` | Percentual, não valor absoluto — mas multiplica dinheiro | ✅ **Migrar** — erro de ponto flutuante num percentual usado em toda venda futura composta ao longo do tempo |
| `Affiliate.commissionPercent` | Idem | ✅ **Migrar** — é o multiplicador central da comissão |
| `SaleAttribution.value` | Sim — valor da venda atribuída (usado em relatórios de receita) | 🟡 **Fora do escopo direto do afiliado, mas mesma classe de risco** — recomendo incluir na mesma migration, já que alimenta os mesmos relatórios financeiros |
| `TrackedConversion.value` | Sim — valor de conversão rastreada via webhook | 🟡 Mesma observação que `SaleAttribution.value` |
| `MetricSnapshot.receita` | Sim — receita agregada diária, usada em ROI/ROAS de todo o produto | ⚪ **Fora de escopo** — mudar isso afeta `__tests__/metrics.test.ts` e `__tests__/calculations.test.ts` já existentes e é uma superfície muito maior que a carteira de afiliados. Registro como dívida técnica separada, não deste projeto. |
| `MetricSnapshot.gasto` | Sim — gasto de mídia agregado | ⚪ Mesma observação |
| `Campaign.budget` / `.spend` | Sim — orçamento/gasto de campanha de anúncio | ⚪ Fora de escopo — não toca em comissão de afiliado |
| `Goal.targetValue` / `.currentValue` | **Depende** — `Goal` é genérico e também guarda contagens não-monetárias (nº de vendas, conversas, cliques — confirmei em `app/api/goals/check/route.ts`) | ⚪ Fora de escopo — campo de unidade mista, não dá para migrar isoladamente sem redesenhar `Goal` também |
| `AILog.costUsd` | Sim, mas é custo interno de operação (OpenAI), não dinheiro de cliente/afiliado | 🟢 Baixa prioridade — recomendo migrar por consistência, mas não é bloqueador |

**Recomendação:** migrar as 5 linhas ✅ como parte deste projeto (são a base
de cálculo de todo o dinheiro que sai da empresa via comissão); as 2 linhas 🟡
migrar junto se o esforço adicional for pequeno (são poucos campos, mesma
migration); as ⚪ ficam fora — são um projeto de "higiene financeira" maior,
não específico de afiliados, e mexer nelas teria raio de impacto sobre
testes/relatórios que já existem hoje e não fazem parte deste pedido.

- **Decimal, nunca float:** todos os campos monetários novos (Seção 1) como
  `Decimal @db.Decimal(12,2)`.
- **Unicidade:** listada por completo na Seção 6.
- **`onDelete`:** trocar `Affiliate → AffiliateSale` de `Cascade` (atual) para
  **nunca cascatear** dado financeiro. Proposta: `Affiliate` nunca é apagado
  fisicamente — só `status = BLOCKED`. Histórico financeiro é retido
  indefinidamente (isso provavelmente também é exigência legal/fiscal
  brasileira — nota fiscal, IR — **fora do meu escopo opinar sobre direito
  tributário; recomendo validação jurídica** antes de definir política de
  retenção/exclusão).
- **Índices:** `@@index([affiliateId, createdAt])` no ledger (paginação de
  histórico), `@@index([status])` em `AffiliateCommission` e
  `AffiliatePayout` (filas administrativas).
- **RLS:** as novas tabelas não têm `userId` direto, só `affiliateId` — a
  policy precisa de `EXISTS` contra `Affiliate.userId`, mesmo padrão já usado
  para `FunnelStage`/`FunnelEvent` (tabelas filhas sem `userId` direto) na
  migration `20260607000000_enable_rls`. **Isso se conecta diretamente ao
  trabalho de RLS já pendente desta auditoria** (as 11 tabelas descobertas
  anteriormente) — deve entrar no mesmo lote de validação em banco de teste,
  não como esforço separado.

---

## 14. Isolamento de tenant

Mesmo princípio já provado no resto do projeto, em três camadas:
1. RLS no banco (uma vez migrado) — rede de segurança estrutural.
2. `findFirst({ where: { id, ...posse } })` em toda rota — defesa em
   profundidade mesmo antes do RLS.
3. Suíte de teste de IDOR explícita (Seção 21).

---

## 15. Frontend não confiável — checklist de campos nunca aceitos como autoridade

`balance`, `availableBalance`, `commission`, `percentage`, `payoutStatus`,
`commissionStatus`, `affiliateId` (em rota de checkout/atribuição —
**achado da Seção 0**), `saleId`, `stripePaymentId`, `amountPaid`, `plan`,
`customerId`. Tudo isso é **derivado no servidor** a partir da sessão
autenticada e de fontes verificáveis (webhook assinado, banco).

**Limite de escopo, dito com honestidade:** este desenho protege contra o
frontend/cliente mal-intencionado e contra bugs de aplicação. Não protege
contra um operador com acesso direto e privilegiado ao banco de produção —
isso é controle de acesso de infraestrutura (quem tem a `DATABASE_URL`,
backups, logs de acesso ao Postgres), um limite operacional diferente do
limite de código que este documento cobre.

---

## 16. Mapeamento de eventos por processador

Tabela completa (Stripe + Mercado Pago lado a lado) já está na **Seção 4.4** —
não duplico aqui para evitar as duas divergirem. Resumo dos mecanismos
antifraude de transporte, por processador:

**Stripe** — assinatura HMAC nativa (`stripe.webhooks.constructEvent`, já
implementado e correto), `claimStripeEvent` (dedup de transporte, já
implementado) e as constraints únicas de domínio da Seção 6 (backstop mesmo
se as duas primeiras falharem).

**Mercado Pago** — assinatura `x-signature` (já implementada e correta,
verificada na auditoria anterior), `claimMercadoPagoEvent` (dedup, já
implementado), **mais uma camada que a Stripe não precisa**: o handler
sempre re-consulta `getPayment()` na API do MP em vez de confiar no corpo do
webhook (já é o padrão atual, correto) — isso protege contra payload
adulterado em trânsito, mas **não** protege contra a atribuição de afiliado
embutida em `external_reference` (esse é o achado da Seção 0.2, corrigido na
Seção 18.8, não pelo dedup de transporte).

**Duplicidade/fora de ordem/evento falso:** resolvido pelas mesmas três
camadas nos dois processadores — assinatura, dedup de transporte, e
constraints únicas de domínio (Seção 6) como backstop se as duas primeiras
falharem.

---

## 17. Fraude — o que este desenho já cobre vs. fase 2

### Cobre agora (arquitetural, não add-on)

- **Autoindicação:** bloqueada na criação da comissão (`affiliate.userId ===
  purchasingUser.id`), não só na UI.
- **`affiliateId` forjado no checkout:** eliminado — atribuição nunca vem do
  corpo da requisição (Seção 18).
- **Cliques falsos inflando métricas:** já mitigado na correção anterior
  (dedup por IP+afiliado, rate limit) — e agora reforçado por clique nunca
  gerar comissão sozinho.
- **Replay de payout / webhook duplicado:** idempotência (Seção 6).

### Fase 2 (fora do escopo do lançamento, registrar como dívida conhecida)

- Múltiplas contas do mesmo indivíduo se autoindicando por e-mails diferentes
  (precisaria de fingerprint de dispositivo/cartão — o projeto já tem
  `trialPaymentFingerprint` para trial, poderia ser reaproveitado no futuro).
- Disputa entre afiliados pela mesma atribuição (mitigado, não eliminado, pela
  regra de "último clique" + congelamento na primeira conversão — Seção 18).
- Reinstauração de comissão após disputa ganha pelo lojista.

---

## 18. Atribuição — regra única, decomposta em cada sub-pergunta pedida

### 18.1 O fluxo completo, exatamente como pedido

```
?ref=CODE (visitante anônimo chega numa página do FlowSara)
  ↓
AffiliateTracker chama POST /api/affiliates/validate  (server-side confirma que o código existe e está ativo)
  ↓
POST /api/affiliates/click  (server-side registra o clique — dedup já existente)
  ↓ nesta MESMA resposta, o servidor grava:
Set-Cookie: ff_attr=<payload>.<hmac>; HttpOnly; Secure; SameSite=Lax; Max-Age=<janela>
  ↓ (visitante navega, eventualmente cria conta, eventualmente faz checkout — dias/semanas depois)
  ↓
Checkout (Stripe ou MP) — o servidor NUNCA lê affiliateId do corpo desta requisição
  ↓
Pagamento confirmado (invoice.paid / payment.approved)
  ↓
Backend lê o cookie ff_attr da requisição ORIGINAL que criou a sessão de checkout
(guardado no momento da criação da sessão — ver 18.6 sobre o hiato entre clique e pagamento)
  ↓ verifica HMAC → se inválido, trata como "sem atribuição"
  ↓ se User.referredByAffiliateId já está gravado → ignora o cookie, usa o valor já congelado
  ↓ se ainda não está gravado → grava agora, uma única vez
  ↓
Comissão criada, associada ao afiliado da atribuição persistida — nunca ao que o front alegou
```

### 18.2 O cookie HMAC é suficiente? — análise ponto a ponto

| Risco | O cookie HMAC sozinho resolve? | O que fecha a lacuna |
|---|---|---|
| **Adulteração** (visitante edita o valor do cookie manualmente) | Sim, na leitura — qualquer edição quebra a assinatura, servidor recalcula HMAC e rejeita. `httpOnly` já impede a via mais fácil (JS da própria página), mas não impede edição manual via DevTools → por isso a verificação de assinatura, não o `httpOnly`, é a proteção real. | Verificação de HMAC em toda leitura, fail-closed |
| **Replay** (reenviar um cookie válido capturado de outra sessão/pessoa) | **Não, sozinho não.** Um cookie assinado continua válido até expirar — se vazado (rede insegura, log, XSS teórico), pode ser reproduzido por outra pessoa. | Incluir `expiresAt` dentro do payload assinado (não só depender do `Max-Age` do cookie, que o navegador pode ignorar/manipular) + a atribuição só tem efeito **uma vez** (na primeira conversão) — depois disso o cookie reproduzido em outra sessão não faz nada, porque `referredByAffiliateId` já está congelado. O "replay" só teria efeito prático numa corrida bem estreita: interceptar o cookie de alguém que ainda não converteu e converter antes dele — mitigado por HTTPS obrigatório (`Secure`) e pela superfície pequena (cookie não trafega em request cross-origin por causa de `SameSite=Lax`). |
| **Troca de afiliado** (A clica, depois B clica) | Sim — o cookie mais recente sobrescreve o anterior (política "último clique" — Seção 18.4), e isso é intencional, não um bug a fechar. |
| **Atribuição retroativa indevida** (gerar comissão sobre uma venda que já aconteceu antes do clique) | Sim — a checagem em 18.1 só lê o cookie da sessão de checkout **em andamento**; não há como um clique posterior "alcançar" uma venda já registrada, porque a comissão nasce no evento de pagamento, e o pagamento só acontece depois do clique que o originou. |
| **Manipulação do checkout** (cliente tenta forçar `affiliateId` no corpo, como acontece hoje) | Sim — a rota de checkout **para de ler esse campo do corpo**, ponto. Não há mais "campo para manipular" nessa direção. |

**Resposta direta: o cookie HMAC é suficiente contra adulteração e contra
manipulação do checkout, mas *sozinho* não é suficiente contra replay — precisa
do payload conter validade própria e da atribuição só valer uma vez (efeito
colateral write-once), que juntos fecham a lacuna.**

### 18.3 Por que não confiar em `localStorage` (como é hoje)

O `AffiliateTracker` atual grava o código em `localStorage` no navegador —
**controlável pelo próprio visitante** via DevTools, exatamente o tipo de
dado que a Seção 15 proíbe tratar como autoridade. Isso é substituído
integralmente pelo cookie `httpOnly` assinado.

### 18.4 Regra de atribuição: último clique válido — e por que não primeiro clique

| Modelo | Como funciona | Por que não escolhi |
|---|---|---|
| **First click** | O primeiro afiliado que trouxe o visitante fica com a venda para sempre, mesmo que outro afiliado traga o clique de conversão de fato | Recompensa quem "descobriu" o cliente, mas é mais fácil de abusar: um afiliado grande poderia "carimbar" tráfego cedo (ex.: link em conteúdo de alto alcance) e capturar conversões que vieram do esforço de conversão de outro afiliado depois |
| **Last eligible click (escolhido)** | O clique mais recente **dentro da janela de atribuição** é quem recebe a comissão | Mais simples de auditar ("quem trouxe a venda de fato"), é o padrão de mercado na maioria dos programas de afiliados, e desincentiva "carimbar" tráfego sem esforço de conversão |

### 18.5 Cada sub-pergunta, sem deixar implícito

| Situação | Regra |
|---|---|
| A é clicado, depois B é clicado (antes de qualquer conversão) | B substitui A — último clique vence. Nenhuma comissão foi gerada ainda, então não há nada a "desfazer", só o cookie é sobrescrito. |
| Usuário já tem conta (loga, depois clica num link de afiliado) | O clique ainda grava o cookie normalmente. Se `User.referredByAffiliateId` **já estiver gravado** (de uma conversão anterior), o novo clique **não sobrescreve** — atribuição já congelada vale mais que clique novo (ver 18.7). Se o usuário nunca converteu antes, o clique novo é elegível como qualquer outro. |
| Usuário já iniciou trial (mas ainda não pagou) | Trial sozinho **não congela atribuição** — só o pagamento confirmado (`invoice.paid`/`payment.approved`) congela. Um clique de afiliado durante o trial é válido e pode definir quem recebe a comissão quando o trial converter em pago. |
| Usuário clica de novo meses depois (já é cliente pagante) | Não tem efeito sobre a assinatura já atribuída — `referredByAffiliateId` já está congelado desde a primeira conversão (18.7). O clique novo só teria efeito se esse usuário viesse a comprar um produto/plano **diferente e ainda não atribuído** (não é o caso do FlowSara hoje, que tem um único ciclo de assinatura por conta — registro para o caso de o produto crescer). |
| Usuário tenta indicar a própria conta | Bloqueado na criação da comissão (`affiliate.userId === purchasingUser.id` → recusa), independente do que o cookie diga. Verificado no momento da comissão, não só no clique, porque o clique pode ter sido feito antes de o afiliado saber que era autoindicação (ex.: compartilhou o link e clicou no próprio para testar). |
| Atribuição pode ser alterada depois de congelada? | **Não pelo frontend, nunca.** Só por admin, via `ADJUSTMENT` auditado — e mesmo assim, isso corrige o **ledger financeiro** (uma comissão específica), não reescreve `User.referredByAffiliateId` retroativamente. Se um erro de atribuição for identificado depois, a correção é financeira (estornar a comissão do afiliado errado, criar uma nova para o correto, ambas auditadas), não uma edição silenciosa do campo de atribuição. |

### 18.6 O hiato entre clique e checkout — onde o cookie precisa "viajar"

Ponto que merece ficar explícito: entre o clique e o pagamento pode haver
dias ou semanas, múltiplas visitas, e o checkout em si roda numa página
diferente da que recebeu o `?ref=`. A garantia não depende de "lembrar" nada
em memória de servidor — o cookie **é** o mecanismo de persistência entre
essas duas pontas, exatamente como cookies de sessão já fazem no resto da
aplicação. O servidor só precisa ler o cookie **no momento em que a sessão de
checkout é criada** (não no momento do pagamento em si, que pode vir de um
webhook assíncrono sem requisição HTTP do navegador) e gravar essa leitura
associada à sessão/customer da Stripe/MP, para que o webhook (que não tem
acesso a cookies do navegador) consiga recuperá-la depois.

### 18.7 Congelamento

No momento da **primeira conversão paga**, o servidor lê o cookie e grava
`User.referredByAffiliateId` **uma única vez** — campo durável, não
recalculado a cada renovação. Cliques de outros afiliados **depois** dessa
gravação não alteram a atribuição daquele usuário — resolve a "disputa entre
afiliados" e garante que renovações sempre atribuem ao mesmo afiliado da
venda original.

Sem cookie válido no momento da conversão → sem atribuição → venda orgânica,
sem comissão. **Aceito como trade-off correto:** é preferível perder
atribuição legítima ocasional (bloqueador de cookie, navegação cross-device)
a aceitar atribuição forjada.

**Depois de definida, a atribuição não é alterável pelo frontend** — não
existe rota que aceite `referredByAffiliateId` do cliente; só é gravada pelo
servidor no fluxo acima, e só corrigível por admin via `ADJUSTMENT` auditado.

### 18.8 Mercado Pago — a mesma proteção, adaptada ao formato do processador

A Seção 0.2 mostrou que o MP tem a mesma falha da Stripe, por um caminho
diferente (`external_reference` construída a partir de body do cliente). A
correção é a mesma regra do cookie assinado, com uma diferença de mecânica:

- Hoje, `create-preference` grava o `affiliateId` (vindo do cliente) dentro
  de `external_reference`, que o webhook lê de volta sem verificação.
- **Proposto:** `create-preference` deixa de aceitar `affiliateId`/`couponCode`
  do corpo para fins de atribuição — lê o cookie assinado da mesma forma que
  o lado Stripe, resolve `User.referredByAffiliateId` (se já congelado) ou o
  afiliado do cookie (se ainda não), e é **esse valor resolvido no servidor**
  que vai para `external_reference` — não mais o valor bruto do cliente.
  `couponCode` continua podendo vir do cliente **só para aplicar desconto**
  (dado comercial, não financeiro-sensível da mesma forma), mas não decide
  mais quem recebe comissão.
- O webhook do MP passa a validar que o `affiliateId` embutido em
  `external_reference` bate com a atribuição persistida do `userId` também
  presente na referência — **defesa em profundidade**: mesmo que alguém
  conseguisse adulterar a criação da preferência por algum caminho não
  previsto, o webhook rejeitaria a incoerência em vez de confiar cegamente.

---

## 19. Saque — modelo inicial manual

Conforme pedido: **saque manual**, sem automação de pagamento nesta fase.

```
Afiliado solicita (REQUESTED, funds reservados atomicamente)
  → Admin revisa (UNDER_REVIEW/APPROVED)
  → Admin paga via Pix manualmente (fora do sistema)
  → Admin confirma no painel (PAID, liquidação final no ledger)
```

Automação (ex.: integração com API de Pix) fica explicitamente para uma fase
posterior, só depois de o fluxo manual estar validado em produção.

---

## 20. Threat model

| Ameaça | Onde poderia ocorrer | Mitigação neste desenho |
|---|---|---|
| **`affiliateId` spoofing** | Corpo de `create-subscription`/`create-preference` (achado real, Seção 0) | Checkout para de ler esse campo do corpo; atribuição vem só do cookie assinado (Seção 18) |
| **Enumeração de código de afiliado** | Força bruta contra `/api/affiliates/validate` para descobrir códigos ativos | Rate limit por IP (já aplicado na correção anterior desta auditoria); a existência de um código não é, sozinha, suficiente para gerar comissão — precisa de clique + cookie + conversão |
| **Autoindicação (self-referral)** | Afiliado compra o próprio produto usando o próprio link | Bloqueado na criação da comissão (`affiliate.userId === purchasingUser.id`), verificado no momento da comissão, não só no clique (Seção 18.5) |
| **Account takeover tentando alterar atribuição** | Invasor com acesso à conta de um usuário já convertido tenta re-atribuir a comissão a outro afiliado | Estruturalmente impossível pela via normal — não existe rota que aceite `referredByAffiliateId`/`affiliateId` de mutação após a conversão; a única via é `ADJUSTMENT` administrativo auditado, que exige `role === ADMIN`, não a sessão do usuário/afiliado |
| **Replay de cookie** | Cookie de atribuição capturado e reproduzido em outra sessão/pessoa | Analisado em detalhe na Seção 18.2 — mitigado por `expiresAt` no payload assinado + atribuição write-once (só tem efeito na primeira conversão) + `Secure`/`SameSite=Lax` |
| **Manipulação de checkout** | Cliente injeta campos extras no corpo do checkout (`affiliateId`, `plan`, `amount`) | `affiliateId` ignorado (Seção 18); `plan` já validado contra allowlist hoje; `amount` nunca é aceito do cliente em nenhuma rota de checkout (preço sempre resolvido no servidor a partir do plano — já confirmado na auditoria de billing anterior) |
| **Duplicate webhook** | Stripe/MP reentregam o mesmo evento | `claimStripeEvent`/`claimMercadoPagoEvent` (dedup de transporte, já existentes) + constraints únicas de domínio (Seção 6) como backstop |
| **Webhook fora de ordem** | Evento antigo chega depois de um mais novo (ex.: `invoice.paid` atrasado depois de um `subscription.deleted`) | Já é um achado tratado na auditoria de billing anterior para o estado da assinatura (comparação de timestamp do evento); a criação de comissão em si é idempotente por `invoice.id`/`payment.id`, então mesmo fora de ordem não duplica — só a ORDEM de aplicação de estado de assinatura importa, não a de criação de comissão |
| **Duplicate commission** | Mesmo evento de pagamento gerando 2 comissões | `AffiliateCommission.saleId @unique` + `AffiliateSale.@@unique([processor, externalPaymentId])` (Seção 6) — dupla camada |
| **Double payout** | Mesmo saque sendo pago duas vezes, ou dois saques simultâneos excedendo o saldo | `UPDATE` atômico condicional na reserva (Seção 8) + `idempotencyKey` na liquidação (`payout-settle:${payoutId}`, Seção 6) — cobre tanto a corrida quanto o duplo-clique administrativo em "marcar como pago" |
| **Race condition / double-spend** | Dois saques simultâneos do mesmo saldo (cenário explícito do pedido) | `UPDATE` atômico condicional (Seção 8) |
| **Negative balance** (não controlado) | Clawback tardio deixando saldo negativo sem limite/visibilidade | Tratado como decisão explícita de negócio (Seção 4.5, opções A-E) — o desenho técnico suporta qualquer uma das opções; a política é escolha sua |
| **Spoofing de webhook** | Payload forjado se passando por evento Stripe/MP | Assinatura HMAC nativa dos dois processadores, já implementada e correta (auditoria anterior) |
| **IDOR** | Ler/mutar carteira ou payout de outro afiliado | Ownership por `session.user.id` em toda rota + RLS (Seção 14) |
| **Privilege escalation** | Afiliado tentando agir como admin | Rotas administrativas com verbo específico + `requireAdmin()`, nunca um campo `role` aceito do cliente |
| **SQL/Prisma injection** | — | Prisma parametriza tudo; único SQL bruto é o `UPDATE` atômico da Seção 8, com valores bindados, não interpolados |
| **Mass assignment** | `{ ...body }` direto num `create`/`update` financeiro | Proibido por convenção — já é o padrão hoje em todo o projeto (nenhuma ocorrência encontrada na auditoria anterior); reforçar com schema explícito (Zod, ainda não usado no projeto — ver decisão) |
| **CSRF** | Ação de saque via sessão de cookie | NextAuth já usa `sameSite=lax`; ação de saque deve ser `POST` (não `GET`), consistente com a correção já aplicada nesta auditoria contra mutação via `GET` |
| **Rate limit** | Spam de solicitação de saque, brute-force de leitura de ledger | `checkRateLimit` (já existente, distribuído em Postgres) em toda rota nova |
| **Abuso de payout** | Múltiplos saques pequenos para evadir revisão | Fora do escopo de código — regra de negócio (limite/frequência), Seção 22-B |

---

## 21. Estratégia de testes (propostos, não escritos ainda)

Seguindo a convenção **já estabelecida** neste projeto (`__tests__/rls.test.ts`,
`__tests__/webhook-failclosed.test.ts` — testes de integração reais contra
banco/app rodando, não só unitário):

- `affiliate-wallet-calculations.test.ts` (unitário, puro): arredondamento de
  comissão, tabela de transição de estados do payout, cálculo de reversão
  proporcional.
- `affiliate-wallet-idempotency.test.ts`: mesmo evento Stripe processado 2x →
  1 comissão; mesmo payout reenviado com a mesma `idempotencyKey` → 1 payout;
  webhook duplicado não duplica reversão.
- `affiliate-wallet-concurrency.test.ts`: **o teste central** — dois saques
  simultâneos de R$100 contra saldo de R$100 via `Promise.all`, afirmar que
  exatamente 1 sucede e o outro recebe "saldo insuficiente"; saldo final
  confere com o ledger.
- `affiliate-wallet-idor.test.ts`: Tenant A não lê/edita carteira, comissão ou
  payout do Tenant B — via API e via manipulação direta de ID; usuário comum
  (não afiliado) não acessa rotas de afiliado; afiliado não acessa rotas
  admin.
- `affiliate-wallet-fraud.test.ts`: autoindicação bloqueada; `affiliateId`
  forjado no corpo do checkout ignorado (só o cookie assinado vale);
  reembolso/chargeback reverte comissão corretamente; renovação gera nova
  comissão vinculada ao afiliado original mesmo sem clique recente.
- `affiliate-wallet-authz.test.ts`: tentativa de alterar `status` de payout
  pelo afiliado rejeitada; tentativa de setar `amount`/`percentage`/`balance`
  direto ignorada.

---

## 22. Classificação final

### A. Decisões já técnicas (não precisam da sua palavra — são consequência direta dos requisitos que você já deu)

- Ledger de partida dobrada com contas virtuais `PENDING`/`AVAILABLE`/`RESERVED` (Seção 2).
- Saldo materializado com ledger como fonte de verdade (Seção 3).
- `UPDATE` atômico condicional para concorrência de saque (Seção 8).
- Atribuição via cookie `httpOnly` assinado com HMAC, write-once no
  `User.referredByAffiliateId`, nunca lido do corpo do checkout (Seção 18) —
  em ambos os processadores.
- Regra de atribuição "último clique válido" em vez de "primeiro clique" (Seção 18.4).
- Autoindicação sempre bloqueada na criação da comissão, não só na UI (Seção 18.5).
- Tabela completa de chaves de idempotência e constraints únicas (Seção 6).
- Endpoints administrativos com verbo específico, nunca `PATCH { status }` genérico (Seção 7).
- Separação `AffiliateSale` (fato) / `AffiliateCommission` (obrigação) (Seção 1).
- `onDelete` nunca cascateando dado financeiro; `Affiliate` nunca apagado fisicamente, só bloqueado (Seção 13) — **exceto** a política de retenção em si, que depende de validação jurídica (item C abaixo).

### B. Decisões que dependem de regra de negócio sua

1. **Saldo negativo após clawback tardio** — Seção 4.5, opções A a E comparadas tecnicamente, nenhuma escolhida.
2. **Reembolso parcial** — reversão proporcional vs. reversão total (Seção 4.4).
3. **Valor mínimo de saque e frequência máxima** — não definido em lugar nenhum ainda.
4. **Janela de maturação da comissão** (proposta de trabalho: 15 dias) — Seção 4.3.
5. **Janela de atribuição do cookie** (proposta de trabalho: 30 dias) — Seção 18.1.
6. **`UNDER_REVIEW`/`PROCESSING` como passos manuais distintos** vs. fundir com `APPROVED` — Seção 7.
7. **Reinstauração de comissão após disputa ganha pelo lojista** — proposto para fase 2 (Seção 4.4), confirmar se aceitável adiar.
8. **Mecanismo de integridade do saldo:** trigger+`REVOKE` de coluna vs. disciplina de código (Seção 3, recomendo a segunda para V1, mas é decisão sua).
9. **Renovação Mercado Pago:** confirmar se existe algum mecanismo de cobrança recorrente via MP fora do que auditei, já que a API nativa de assinatura do MP não está em uso hoje (Seção 4.0.3) — isso afeta diretamente a expectativa de receita recorrente por esse canal.

### C. Decisões que dependiam de verificar Stripe/Mercado Pago — já verificadas nesta revisão

- ✅ **"Fundador vitalício" não existe no código** — é copy antiga do README. Todos os planos ativos são recorrentes (`mode: 'subscription'`). `invoice.paid` cobre 100% da superfície Stripe atual (Seção 4.0).
- ✅ **Mercado Pago não usa assinatura nativa** — cada compra é pagamento único; "renovação" via MP não é billing automático (Seção 4.0.3). Isso virou o item B.9 acima, que só você pode confirmar (é sobre expectativa de negócio, não sobre o que o código faz).
- ✅ **Webhook do Mercado Pago não trata chargeback (`charged_back`)** — achado novo desta revisão, confirmado lendo o código (Seção 4.4), não presumido.
- ✅ **`affiliateId` do Mercado Pago vem de `external_reference` sem verificação independente** — confirmado lendo `webhooks/mercadopago/route.ts` (Seção 0.2).

**Nada ficou pendente de verificação de código nesta categoria** — as três perguntas que dependiam de olhar Stripe/MP real foram todas respondidas com evidência de arquivo:linha.

### D. Alterações de schema necessárias (nenhuma aplicada — só listadas)

**Novos models:** `AffiliateCommission`, `AffiliateLedgerEntry`, `AffiliateWallet`, `AffiliatePayout`, `AffiliatePayoutItem` (Seção 1).

**Novos campos em models existentes:**
- `User.referredByAffiliateId` (Seção 18.7).
- `AffiliateSale`: trocar chave única de `stripePaymentId` para
  `@@unique([processor, externalPaymentId])`, adicionar `processor` (enum
  `STRIPE`/`MERCADOPAGO`), `type` (`INITIAL`/`RENEWAL`) (Seção 6).

**Migração de tipo (`Float` → `Decimal`)** — inventário completo na Seção
13.1: `AffiliateSale.originalAmount/discountedAmount/commissionAmount`,
`Affiliate.discountPercent/commissionPercent` (obrigatório para este
projeto); `SaleAttribution.value`, `TrackedConversion.value` (recomendado,
mesma classe de risco); `MetricSnapshot.*`, `Campaign.*`, `Goal.*`,
`AILog.costUsd` (fora de escopo, dívida técnica separada).

**Mudança de `onDelete`:** `AffiliateSale.affiliate` de `Cascade` para
não-cascateante (Seção 0.3/13).

**RLS:** as tabelas novas entram no mesmo lote de validação já pendente das
11 tabelas descobertas na auditoria anterior (Seção 13) — não é um esforço
de RLS separado.

### E. Riscos restantes (mesmo depois deste desenho)

- **Limite operacional, não de código:** nenhuma proteção aqui impede um
  operador com acesso direto e privilegiado ao Postgres de produção de
  alterar dado financeiro — isso é controle de acesso de infraestrutura,
  fora do escopo deste documento (Seção 15).
- **Retenção legal de dado financeiro** — provavelmente exigência fiscal
  brasileira (nota fiscal, IR sobre comissão paga a afiliado), não validada
  juridicamente por mim (Seção 13).
- **Fraude por múltiplas contas** (mesmo indivíduo se autoindicando via
  e-mails diferentes) — reconhecido e adiado para fase 2 (Seção 17), não
  resolvido por este desenho.
- **Disputa entre afiliados pela mesma atribuição** — mitigado pela regra de
  último clique + congelamento, mas não eliminado (alguém sempre "perde" a
  atribuição por definição de qualquer regra de atribuição — isso é inerente
  ao problema, não uma falha do desenho).
- **Clawback tardio continua exigindo processo humano** — nenhuma automação
  aqui desfaz um Pix já enviado; o desenho só garante que o evento fica
  registrado e visível (Seção 4.4).
- **Dependência não verificada:** se existir algum mecanismo de renovação
  Mercado Pago fora do código auditado (ex.: rotina externa, processo manual
  recorrente), este desenho não o cobre até ser descrito (item B.9).

---

---

## 23. Decisões de negócio para aprovação — rodada final

Requisito de segurança que rege toda decisão abaixo, repetido de propósito
porque é o critério de aceite do sistema inteiro:

> **Se um atacante controlar completamente o frontend e puder alterar
> qualquer request, ele ainda não pode criar, aumentar, transferir ou sacar
> um centavo de comissão que não tenha sido legitimamente gerado.**

Nenhuma das decisões abaixo, em nenhuma das alternativas, viola essa regra —
todas são políticas de **negócio** (quando pagar, quanto reter, qual o
mínimo), não brechas de segurança. A segurança já está garantida
estruturalmente pela Seção 20 (threat model) independente de qual alternativa
você escolher aqui.

### A. Janela de atribuição

| Janela | Impacto |
|---|---|
| 7 dias | Atribuição muito curta para o ciclo de decisão típico de conteúdo de afiliado (vídeo/podcast → several dias de consideração → cadastro). Risco real de **perder atribuições legítimas**, frustrando afiliados que fizeram o trabalho de convencer o cliente. Vantagem: janela de replay de cookie (Seção 18.2) fica minúscula. |
| **30 dias (recomendado)** | Padrão de mercado da maioria dos programas de afiliados. Equilibra reconhecer ciclos de decisão razoáveis sem deixar atribuição "velha" demais. |
| 60 dias | Adequado para ciclos de venda B2B mais longos, mas aumenta o risco de atribuir uma compra a um clique que não teve relação real com a decisão (o visitante pode ter esquecido completamente do afiliado e decidido comprar por outro motivo 2 meses depois). |
| 90 dias | Mesmo trade-off de 60 dias, amplificado. Normalmente reservado para venda enterprise de ticket alto — não parece o perfil do FlowSara (SaaS self-serve de R$97-297/mês). |

**Recomendação: 30 dias.** É o ponto de partida mais seguro e mais fácil de
justificar para os afiliados ("padrão do mercado"), com espaço para ajustar
depois com dado real de quanto tempo passa entre clique e conversão neste
produto especificamente.

### B. Usuário que já iniciou trial, depois clica em afiliado

**Minha recomendação técnica/comercial:** o **trial sozinho não congela
atribuição** — só a **primeira conversão paga** congela (Seção 18.7,
mantida). Um clique de afiliado que acontece *durante* o trial (antes de
qualquer pagamento) é elegível normalmente pela regra de último clique.

**Por que isso não contradiz sua preferência** ("depois que a conversão ...
estiver vinculada a uma origem, ela não seja substituída"): a sua frase usa
a palavra **conversão**, não **trial** — e é exatamente isso que este desenho
já faz. A distinção importa porque:

- Trial não gera nenhuma comissão (não há dinheiro em jogo ainda) — travar
  atribuição nesse momento só serviria para *impedir* que um afiliado que
  genuinamente convenceu o usuário a virar cliente pagante recebesse crédito,
  caso o clique dele tenha acontecido depois do início do trial.
- Se um usuário inicia trial **sem nenhum clique de afiliado** (veio
  organicamente) e só depois, ainda no trial, clica num link de afiliado —
  bloquear essa atribuição seria pior para o negócio: a venda ficaria "órfã"
  mesmo havendo um afiliado que participou da decisão.

**Momento exato do congelamento, sem ambiguidade:** o instante em que o
webhook processa o primeiro `invoice.paid` (Stripe) ou `payment.approved`
(Mercado Pago) daquele usuário — não o clique, não o cadastro, não o início
do trial. A partir desse instante, `User.referredByAffiliateId` está gravado
e **nenhum clique futuro o altera**, inclusive cliques que aconteçam durante
a janela de atribuição de 30 dias — a regra de "último clique" só se aplica
**antes** do congelamento.

### C. Regra formal de comissão recorrente Stripe

> Para cada `invoice.paid` de uma assinatura cujo `User.referredByAffiliateId`
> aponte para um afiliado válido, não autoindicado:
>
> `commissão = ROUND_HALF_UP(invoice.amountPaid × affiliate.commissionPercent / 100, 2 casas decimais)`
>
> Essa fórmula é aplicada **em toda cobrança válida**, inicial ou renovação,
> **enquanto a assinatura permanecer ativa e cada cobrança individual for
> confirmada como paga**. Não há limite de número de renovações comissionáveis.
> O percentual usado é o `Affiliate.commissionPercent` **no momento daquela
> cobrança específica** — gravado (snapshot) dentro da própria
> `AffiliateCommission`, não recalculado depois se o percentual do afiliado
> mudar no futuro (garante que uma comissão já criada nunca muda de valor
> retroativamente por causa de uma renegociação comercial).

Exemplo do seu pedido, formalizado: cliente indicado paga R$147,00/mês,
afiliado com 30% → cada `invoice.paid` gera `ROUND(147,00 × 0,30, 2) =
R$44,10`, todo mês, enquanto a assinatura seguir ativa e cada fatura for paga.

### D. Retenção da comissão (`PENDING` → `AVAILABLE`)

**Recomendação: 15 dias.**

Raciocínio: não existe uma resposta puramente técnica aqui (é política de
risco), mas 15 dias é o ponto de equilíbrio mais comum em sistemas de
comissão B2C/B2B de ticket baixo-médio — curto o suficiente para não
frustrar o afiliado com uma espera longa, longo o suficiente para cobrir a
maioria das disputas/estornos que acontecem nos primeiros dias após a
cobrança (a maior parte dos chargebacks e pedidos de reembolso por
insatisfação imediata acontece na primeira ou segunda semana). Chargebacks
que chegam depois dos 15 dias continuam cobertos pelo mecanismo de clawback
tardio (decisão E) — a janela de retenção reduz a *frequência* do caso
difícil, não o elimina.

### E. Clawback — solução recomendada para V1

Entre as 5 opções que você listou, **recomendo a combinação (opção 5),
composta especificamente assim:**

1. **Saldo pode ficar negativo** (`availableBalance` sem piso mínimo zero) —
   é o mecanismo mais simples e é pré-requisito técnico das outras duas partes
   da combinação.
2. **Compensação automática com comissões futuras** — toda nova
   `COMMISSION_MATURE` primeiro abate o saldo negativo antes de virar sacável
   de fato. Isso resolve a dívida organicamente, sem exigir cobrança externa
   ao afiliado.
3. **Bloqueio de novos payouts enquanto o saldo estiver negativo** — protege
   o caixa da empresa: o afiliado não consegue sacar nada novo até a dívida
   ser absorvida pelas comissões futuras (ou zerada manualmente por admin,
   via `ADJUSTMENT`, em caso excepcional).

**Por que esta é a mais segura operacionalmente para uma V1, comparada às
outras:** não exige um model novo (`AffiliateDebt`, opção 2 da rodada
anterior) nem um processo de cobrança externa ao afiliado (que este sistema
não tem meios de executar automaticamente de qualquer forma — não há
integração de cobrança de afiliado, só de pagamento a ele). É a opção com
menor superfície de implementação que ainda cobre o cenário completo do seu
exemplo (Pix já enviado, chargeback depois).

### F. Saque mínimo

**Recomendação: R$100,00** (seu próprio exemplo).

Motivo: a razão principal **não é custo de transferência** (Pix é
essencialmente gratuito) — é **custo operacional administrativo**. Cada
payout em V1 exige revisão humana e envio manual de Pix (decisão G); um
mínimo baixo (ex.: R$10) multiplicaria o número de solicitações que a equipe
precisa processar manualmente sem aumentar proporcionalmente o valor
movimentado. R$100 também reduz a superfície de abuso de baixo valor (spam
de solicitações pequenas só para gerar trabalho administrativo ou testar o
fluxo).

### G. Payout V1 — confirmado, máquina de estados simplificada

Sua especificação (`REQUESTED → análise administrativa → APPROVED → Pix
manual → admin confirma → PAID`) **substitui** a máquina de 6 estados
proposta na rodada anterior — os estados `UNDER_REVIEW` e `PROCESSING` saem
do desenho, porque você já definiu que a "análise administrativa" acontece
implicitamente antes de `APPROVED`, sem precisar de um estado próprio no
banco. Isso resolve a decisão B.8 da rodada anterior — você já respondeu ela
ao especificar o fluxo exato.

Estado final, usado na Especificação de Implementação abaixo:

```
REQUESTED → APPROVED → PAID
    │            │
    └────────────┴──→ CANCELLED (afiliado, antes de APPROVED) ou admin, a qualquer momento antes de PAID
                 └──→ FAILED (admin, Pix não foi enviado com sucesso) → libera reserva, afiliado pode solicitar de novo
    └──→ REJECTED (admin, ex.: suspeita de fraude) → libera reserva
```

---

## 24. IMPLEMENTATION SPECIFICATION

> Esta seção assume as recomendações A-G acima como padrão de trabalho.
> **Nenhuma foi implementada ainda** — esta especificação é o documento que
> guiará a implementação assim que você aprovar. Onde a especificação
> depende de um valor de negócio (janela, percentual, mínimo), o valor
> recomendado está escrito diretamente no código-exemplo, para que a
> especificação seja concreta — trocar o valor depois é uma linha, não um
> redesenho.

### 24.1 Banco — schema completo proposto

**Simplificação feita nesta passada final, registrada explicitamente:**
removi o model `AffiliatePayoutItem` (join entre payout e comissões
individuais) que estava na rodada anterior. Justificativa: uma vez que uma
comissão amadurece para `AVAILABLE`, ela **se funde** ao saldo agregado da
carteira — dinheiro é fungível, não há necessidade de rastrear "qual
comissão específica" compõe um saque específico, porque isso não muda
nenhuma garantia de segurança ou auditoria (o ledger já registra os
**valores totais** movimentados em cada operação, o que é suficiente para
reconstrução completa do saldo — Seção 2.3). Isso também simplifica o status
de `AffiliateCommission` de 5 estados para 3: **`PENDING | AVAILABLE |
REVERSED`** — os estados `RESERVED`/`PAID_OUT` deixam de existir por
comissão, porque "reservado"/"pago" agora são propriedades do **saldo
agregado da carteira** (`AffiliateWallet.reservedBalance`), não de comissões
individuais.

```prisma
// ── Enums ────────────────────────────────────────────────────────────────

enum AffiliateStatus {
  ACTIVE
  BLOCKED
}

enum PaymentProcessor {
  STRIPE
  MERCADOPAGO
}

enum SaleType {
  INITIAL
  RENEWAL
}

enum CommissionStatus {
  PENDING    // dentro da janela de retenção (Decisão D: 15 dias)
  AVAILABLE  // amadurecida, fundida ao saldo agregado da carteira
  REVERSED   // estornada (refund/chargeback) — nunca chegou a ser sacável, ou foi revertida depois
}

enum LedgerAccount {
  PENDING
  AVAILABLE
  RESERVED
}

enum LedgerEntryType {
  COMMISSION_ACCRUE   // nascimento da comissão — linha única, sem par
  COMMISSION_MATURE   // PENDING → AVAILABLE — par (2 linhas)
  COMMISSION_REVERSE  // estorno — debita onde a comissão estiver hoje
  PAYOUT_RESERVE      // AVAILABLE → RESERVED — par (2 linhas)
  PAYOUT_RELEASE      // RESERVED → AVAILABLE (cancelamento/falha) — par (2 linhas)
  PAYOUT_SETTLE       // liquidação final — linha única, dinheiro sai de verdade
  ADJUSTMENT          // correção manual de admin — linha única, reason obrigatório
}

enum PayoutStatus {
  REQUESTED
  APPROVED
  PAID
  FAILED
  CANCELLED
  REJECTED
}

// ── Models ───────────────────────────────────────────────────────────────

model Affiliate {
  id                String          @id @default(cuid())
  name              String
  email             String?
  code              String          @unique
  discountPercent   Decimal         @db.Decimal(5,2)
  commissionPercent Decimal         @db.Decimal(5,2)
  stripeCouponId    String?
  status            AffiliateStatus @default(ACTIVE)   // substitui isActive: Boolean
  userId            String?         @unique
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  user               User?                  @relation("AffiliateOwner", fields: [userId], references: [id], onDelete: SetNull)
  referredUsers      User[]                 @relation("AffiliateReferral")
  clicks             AffiliateClick[]
  sales              AffiliateSale[]
  commissions        AffiliateCommission[]
  ledgerEntries      AffiliateLedgerEntry[]
  wallet             AffiliateWallet?
  payouts            AffiliatePayout[]

  @@index([code])
  @@index([status])
}

model AffiliateClick {
  id          String   @id @default(cuid())
  affiliateId String
  ip          String?
  userAgent   String?
  createdAt   DateTime @default(now())

  affiliate Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade) // não financeiro — cascade OK

  @@index([affiliateId])
  @@index([createdAt])
}

// User.referredByAffiliateId — campo novo no model User já existente:
//   referredByAffiliateId String?
//   referredByAffiliate   Affiliate? @relation("AffiliateReferral", fields: [referredByAffiliateId], references: [id], onDelete: SetNull)
// onDelete: SetNull — mesmo se um Affiliate fosse removido (não deveria
// acontecer, Seção 13), a conta do cliente referenciado nunca é afetada.

model AffiliateSale {
  id                     String           @id @default(cuid())
  affiliateId            String
  userId                 String?          // SetNull: deleção de conta de cliente não pode falhar por causa disto
  processor              PaymentProcessor
  externalPaymentId      String           // Stripe invoice.id OU MP payment.id
  externalSubscriptionId String?          // Stripe subscription.id — null para MP (sem assinatura nativa, Seção 4.0.3)
  type                   SaleType
  originalAmount         Decimal          @db.Decimal(12,2)
  discountedAmount       Decimal          @db.Decimal(12,2)
  createdAt              DateTime         @default(now())

  affiliate  Affiliate            @relation(fields: [affiliateId], references: [id], onDelete: Restrict)
  user       User?                @relation(fields: [userId], references: [id], onDelete: SetNull)
  commission AffiliateCommission?

  @@unique([processor, externalPaymentId])  // idempotência de domínio (Seção 6)
  @@index([affiliateId, createdAt])
  @@index([userId])
}

model AffiliateCommission {
  id                        String           @id @default(cuid())
  saleId                    String           @unique   // 1:1 com a venda
  affiliateId               String
  amount                    Decimal          @db.Decimal(12,2)
  commissionPercentSnapshot Decimal          @db.Decimal(5,2)  // % aplicado NESTA comissão (Decisão C)
  status                    CommissionStatus @default(PENDING)
  maturesAt                 DateTime         // now() + janela de retenção (Decisão D) no momento da criação
  createdAt                 DateTime         @default(now())

  sale          AffiliateSale          @relation(fields: [saleId], references: [id], onDelete: Restrict)
  affiliate     Affiliate              @relation(fields: [affiliateId], references: [id], onDelete: Restrict)
  ledgerEntries AffiliateLedgerEntry[]

  @@index([affiliateId, status])
  @@index([maturesAt])   // consultado pelo cron de maturação
}

model AffiliateLedgerEntry {
  id              String          @id @default(cuid())
  affiliateId     String
  account         LedgerAccount
  amount          Decimal         @db.Decimal(12,2)   // + crédito, - débito
  type            LedgerEntryType
  transferGroupId String?         // agrupa as 2 linhas de uma transferência
  commissionId    String?         // FK direta (não polimórfica — Seção 24.1 nota abaixo)
  payoutId        String?
  idempotencyKey  String          @unique
  reason          String?         // obrigatório em ADJUSTMENT e COMMISSION_REVERSE
  createdBy       String?         // adminId; nulo = automático/sistema
  createdAt       DateTime        @default(now())

  affiliate  Affiliate            @relation(fields: [affiliateId], references: [id], onDelete: Restrict)
  commission AffiliateCommission? @relation(fields: [commissionId], references: [id], onDelete: SetNull)
  payout     AffiliatePayout?     @relation(fields: [payoutId], references: [id], onDelete: SetNull)

  @@index([affiliateId, createdAt])
  @@index([commissionId])
  @@index([payoutId])
  // SEM updatedAt — reforça que não existe "editar depois" (Seção 2.6)
}

model AffiliateWallet {
  affiliateId      String   @id
  pendingBalance   Decimal  @db.Decimal(12,2) @default(0)
  availableBalance Decimal  @db.Decimal(12,2) @default(0)  // pode ficar negativo — Decisão E
  reservedBalance  Decimal  @db.Decimal(12,2) @default(0)  // nunca negativo — CHECK constraint
  lifetimeEarned   Decimal  @db.Decimal(12,2) @default(0)
  lifetimePaid     Decimal  @db.Decimal(12,2) @default(0)
  updatedAt        DateTime @updatedAt

  affiliate Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Restrict)
}

model AffiliatePayout {
  id             String       @id @default(cuid())
  affiliateId    String
  amount         Decimal      @db.Decimal(12,2)  // valor efetivamente reservado (não o "desejado" bruto do cliente — Seção 9)
  pixKey         String       // snapshot no momento do pedido
  status         PayoutStatus @default(REQUESTED)
  idempotencyKey String
  requestedAt    DateTime     @default(now())
  reviewedBy     String?      // adminId
  reviewedAt     DateTime?
  paidAt         DateTime?
  failureReason  String?
  adminNote      String?

  affiliate     Affiliate              @relation(fields: [affiliateId], references: [id], onDelete: Restrict)
  ledgerEntries AffiliateLedgerEntry[]

  @@unique([affiliateId, idempotencyKey])  // idempotência de criação (Seção 6)
  @@index([affiliateId, status])
}
```

**Nota sobre `commissionId`/`payoutId` como FK direta:** a rodada anterior
propunha `referenceType`/`referenceId` genérico (polimórfico). Troquei para
FK direta nesta passada final — ganha integridade referencial real garantida
pelo Postgres (o banco recusa um `commissionId` que não existe; um campo
`String` livre não recusaria nada), ao custo de ter duas colunas nullable em
vez de uma genérica. Para este domínio (só 2 tipos de referência possíveis),
o ganho de integridade vale a troca.

**Constraints que precisam de SQL bruto na migration** (mesmo padrão já
usado no projeto para RLS — Prisma DSL não expressa `CHECK`/`REVOKE` de
forma portável). Ampliado nesta revisão final por causa dos itens 5, 6, 16 e
17 da checklist adversarial (Seção 24.9):

```sql
-- ── CHECK: nunca depender só de validação em TypeScript ─────────────────

ALTER TABLE "AffiliateWallet"
  ADD CONSTRAINT wallet_reserved_never_negative CHECK ("reservedBalance" >= 0);
-- Nenhum CHECK equivalente em "availableBalance" — pode ficar negativo por
-- desenho (Decisão E).

ALTER TABLE "AffiliatePayout"
  ADD CONSTRAINT payout_amount_minimum CHECK ("amount" >= 100);
-- Item 5 da revisão adversarial: o mínimo de saque (Decisão F) não pode
-- depender só da rota validar — se alguém criar um payout por outro caminho
-- (script de admin, migration de dados, bug futuro), o banco recusa.

ALTER TABLE "Affiliate"
  ADD CONSTRAINT affiliate_commission_percent_range CHECK ("commissionPercent" >= 0 AND "commissionPercent" <= 100),
  ADD CONSTRAINT affiliate_discount_percent_range CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100);
-- Item 6: mesmo que nenhuma rota deste projeto exponha edição desses campos
-- ao afiliado, o CHECK impede que um valor sem sentido (ex.: 300%) chegue
-- ao banco por QUALQUER caminho, presente ou futuro.

ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT commission_amount_positive CHECK ("amount" > 0);

-- ── REVOKE: imutabilidade de fato/obrigação financeira, não só do ledger ──
-- A rodada anterior só revogava UPDATE/DELETE em AffiliateLedgerEntry.
-- Faltava proteger AffiliateSale (fato) e as colunas financeiras de
-- AffiliateCommission (itens 16 e 17 da revisão adversarial).

REVOKE UPDATE, DELETE ON "AffiliateSale" FROM app_rls;
-- Fato imutável — nenhum campo de uma venda já registrada muda depois.

REVOKE DELETE ON "AffiliateCommission" FROM app_rls;
REVOKE UPDATE ("amount", "commissionPercentSnapshot", "saleId", "affiliateId", "maturesAt", "createdAt")
  ON "AffiliateCommission" FROM app_rls;
-- Column-level: só a coluna "status" continua editável pela aplicação (o
-- ciclo de vida PENDING→AVAILABLE→REVERSED é uma máquina de estados
-- legítima), mas nenhum campo financeiro ou de identidade da comissão pode
-- ser alterado depois de criada — nem por um bug, nem por uma rota futura
-- mal desenhada.

REVOKE UPDATE, DELETE ON "AffiliateLedgerEntry" FROM app_rls;
-- ver ressalva sobre SELECT FOR UPDATE não se aplicar aqui — este REVOKE é
-- só nesta tabela, que nunca precisa de row lock (Seção 2.6).

REVOKE DELETE ON "AffiliatePayout" FROM app_rls;
REVOKE DELETE ON "AffiliateWallet" FROM app_rls;
-- Payout e Wallet continuam precisando de UPDATE (máquina de estados do
-- payout; saldo materializado do wallet) — só o DELETE é vedado, porque
-- apagar qualquer um dos dois destruiria histórico/estado financeiro sem
-- deixar rastro no ledger.
```

**Decisão que tinha ficado pendente da rodada anterior, resolvida agora —
como o saldo é protegido contra escrita fora do padrão esperado:**

A rodada anterior apresentou duas opções (trigger+`REVOKE` de coluna vs.
disciplina de código) e recomendou a segunda "para V1, mais simples". Ao
reler o schema com o pedido explícito desta rodada de reforçar o banco,
resolvo esta decisão como puramente técnica (não altera nenhuma regra de
negócio, então trato como as decisões da categoria "A" da Seção 22 anterior
— aplico, e você pode reverter se preferir a via mais simples):

**Escolha final: um conjunto pequeno de funções Postgres `SECURITY DEFINER`
para as operações que mutam saldo**, em vez de disciplina de código pura.

```sql
-- app_rls NÃO tem UPDATE em AffiliateWallet.pendingBalance/availableBalance/
-- reservedBalance — só SELECT. A única forma de mudar esses números é
-- através destas funções, que rodam com o privilégio do dono da tabela
-- (SECURITY DEFINER) e SEMPRE gravam a linha de ledger correspondente
-- dentro da mesma execução.

REVOKE UPDATE ("pendingBalance", "availableBalance", "reservedBalance", "lifetimeEarned", "lifetimePaid")
  ON "AffiliateWallet" FROM app_rls;

CREATE FUNCTION reserve_payout_amount(p_affiliate_id text, p_amount numeric)
RETURNS TABLE("availableBalance" numeric, "reservedBalance" numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  UPDATE "AffiliateWallet"
  SET "availableBalance" = "availableBalance" - p_amount,
      "reservedBalance"  = "reservedBalance"  + p_amount
  WHERE "affiliateId" = p_affiliate_id
    AND "availableBalance" >= p_amount
  RETURNING "AffiliateWallet"."availableBalance", "AffiliateWallet"."reservedBalance";
END;
$$;
-- + funções irmãs no mesmo padrão: release_payout_reservation(),
-- settle_payout(), accrue_commission(), mature_commission(),
-- reverse_commission(), apply_admin_adjustment() — cada uma faz o UPDATE do
-- wallet e o INSERT do(s) ledger entry(ies) correspondentes, sempre juntos,
-- sempre na mesma execução da função.

GRANT EXECUTE ON FUNCTION reserve_payout_amount(text, numeric) TO app_rls;
-- (idem para as demais funções)
```

**Por que isso resolve a ressalva técnica que eu tinha levantado
(`SELECT FOR UPDATE` exige privilégio de `UPDATE`):** não precisamos mais de
`SELECT FOR UPDATE` nenhum — o `UPDATE ... WHERE ... RETURNING` dentro da
função já é atômico sozinho (mesmo mecanismo da Seção 8), e quem tem
privilégio de `UPDATE` na tabela é a função (por ser `SECURITY DEFINER`,
roda como o dono da tabela), não o role `app_rls` da aplicação. A aplicação
só tem `EXECUTE` nas funções — nunca `UPDATE` direto nas colunas de saldo.

**Custo honesto desta escolha:** mais uma camada para testar (as funções
precisam de teste próprio, além dos testes de rota) e mais SQL bruto vivendo
fora do `schema.prisma` (mesmo padrão já aceito no projeto para RLS). Se
isso for demais para a V1, a alternativa "disciplina de código" da rodada
anterior continua tecnicamente válida — é uma troca de robustez por
simplicidade de implementação, não uma questão de correção.

**RLS:** entra no mesmo lote de validação já pendente (Seção 13) — policy
por `EXISTS` contra `Affiliate.userId` para as tabelas sem `userId` direto
(`AffiliateSale`, `AffiliateCommission`, `AffiliateLedgerEntry`,
`AffiliateWallet`, `AffiliatePayout`), mesmo padrão já usado para
`FunnelStage`/`FunnelEvent`.

---

### 24.2 Ledger — regras de entrada, reversão e ajuste (consolidado)

| Tipo de entrada | Quando é criada | Conta debitada | Conta creditada | `reason` obrigatório? |
|---|---|---|---|---|
| `COMMISSION_ACCRUE` | `invoice.paid`/`payment.approved` processado com atribuição válida | — (dinheiro novo) | `PENDING` | Não |
| `COMMISSION_MATURE` | Cron de maturação, `maturesAt <= now()` | `PENDING` | `AVAILABLE` | Não |
| `COMMISSION_REVERSE` | Refund/chargeback confirmado | `PENDING` ou `AVAILABLE` (onde a comissão estiver) | — (dinheiro sai) | **Sim** — referência ao evento de estorno de origem |
| `PAYOUT_RESERVE` | `AffiliatePayout` criado (`REQUESTED`) | `AVAILABLE` | `RESERVED` | Não |
| `PAYOUT_RELEASE` | Payout vai para `CANCELLED`/`FAILED`/`REJECTED` | `RESERVED` | `AVAILABLE` | Sim, quando `REJECTED` (motivo da rejeição) |
| `PAYOUT_SETTLE` | Admin marca `PAID` | `RESERVED` | — (dinheiro sai de verdade) | Não |
| `ADJUSTMENT` | Ação manual de admin | Qualquer conta | Qualquer conta | **Sempre sim** |

Imutabilidade confirmada (repetindo Seção 2.5, agora como regra de
especificação, não só de arquitetura): nenhuma linha acima jamais é
alterada — toda correção é uma nova entrada `ADJUSTMENT` ou
`COMMISSION_REVERSE` referenciando a original.

**Regra de atomicidade explícita (item 1 da revisão adversarial, Seção 24.9):**
a criação de `AffiliateSale` + `AffiliateCommission` + a entrada
`COMMISSION_ACCRUE` correspondente acontecem **na mesma transação**
(`withTenantTx`). Sem isso, uma falha entre os dois `INSERT`s deixaria uma
`AffiliateSale` órfã sem comissão — e como a idempotência de venda é
verificada pela existência da `AffiliateSale`, um reprocessamento futuro do
mesmo evento veria "venda já existe" e nunca criaria a comissão que faltou.
Mesma regra vale para toda transição de conta do ledger: a função que grava
o ledger e a que muda o estado relacionado (`AffiliateCommission.status`,
`AffiliatePayout.status`, `AffiliateWallet.*`) nunca rodam em passos
separados sem transação.

**Corrida entre maturação e reversão na mesma comissão (achado da revisão
adversarial, item 12):** o cron de maturação e o handler de reversão podem,
em teoria, processar a mesma `AffiliateCommission` quase ao mesmo tempo (ex.:
o cron decide amadurecer no instante exato em que um chargeback chega para a
mesma comissão). Ambos usam `UPDATE` condicional no **próprio status da
comissão**, não `SELECT` seguido de decisão:

```sql
-- Maturação:
UPDATE "AffiliateCommission" SET status = 'AVAILABLE'
WHERE id = $1 AND status = 'PENDING' RETURNING *;
-- 0 linhas = já não estava mais PENDING (foi revertida antes) → cron pula, sem erro.

-- Reversão:
UPDATE "AffiliateCommission" SET status = 'REVERSED'
WHERE id = $1 AND status IN ('PENDING', 'AVAILABLE') RETURNING *;
-- 0 linhas = já estava REVERSED (evento duplicado, idempotência) → no-op.
```

Quem chega primeiro "ganha" a linha; o outro processa 0 linhas e trata isso
como caso esperado, não como erro — exatamente o mesmo padrão já usado para
o saldo (Seção 8), aplicado agora à comissão individual.

**Evento de reversão chegando antes de existir comissão (achado da revisão
adversarial, item 12 — cenário adicional):** se um webhook de estorno for
processado antes do `invoice.paid`/`payment.approved` correspondente (ordem
de entrega não garantida, especialmente no Mercado Pago), não existe ainda
nenhuma `AffiliateSale`/`AffiliateCommission` para reverter. Nesse caso o
handler **não cria nada retroativamente** — apenas retorna sem processar
(sem confirmar sucesso ao processador de pagamento), deixando o próprio
mecanismo de reentrega do webhook tentar de novo mais tarde, quando a venda
original já deve ter sido processada.

---

### 24.3 Comissão — de onde nasce até onde morre

| Pergunta | Resposta |
|---|---|
| **Quando nasce** | No processamento de `invoice.paid` (Stripe) ou `payment.approved` (Mercado Pago), com `User.referredByAffiliateId` resolvido e não-nulo, e sem autoindicação (Seção 24.4) — **e em nenhum outro lugar**: nenhuma rota HTTP (de usuário ou admin) cria `AffiliateCommission` diretamente; é sempre um efeito colateral server-side do processamento de webhook (item 4 da revisão adversarial) |
| **De onde vem o valor** | `AffiliateSale.discountedAmount` (o que o cliente pagou de fato, já com desconto de cupom aplicado, se houver) |
| **Como é calculada** | `ROUND_HALF_UP(discountedAmount × affiliate.commissionPercent / 100, 2)` — Decisão C |
| **Como fica idempotente** | `AffiliateCommission.saleId @unique`, que por sua vez depende de `AffiliateSale.@@unique([processor, externalPaymentId])` — dois níveis (Seção 6), criados na mesma transação (acima) |
| **Quando vira `AVAILABLE`** | `maturesAt <= now()`, verificado pelo cron de maturação (Decisão D: `createdAt + 15 dias`), via `UPDATE` condicional (acima) |
| **Como é revertida** | `COMMISSION_REVERSE` na conta onde estiver (`PENDING` ou `AVAILABLE`), status → `REVERSED` via `UPDATE` condicional; se a comissão já se fundiu ao saldo e esse saldo já foi sacado, a reversão ainda ocorre e pode deixar `availableBalance` negativo (Decisão E) — **e a entrada original nunca é tocada** (Decisão E, exigência de histórico intacto — ver Seção 24.9, item 16) |
| **Quem pode ler comissões individuais** | Só leitura, via `GET /wallet/ledger` do próprio afiliado ou `GET /admin/affiliates/:id/ledger`. **Nenhuma rota aceita `commissionId` como input de mutação** (item 8 da revisão adversarial) — a única forma de afetar uma comissão é através dos eventos de webhook (nascimento/reversão) ou do cron (maturação), nunca por uma chamada direta de cliente ou admin visando uma comissão específica |

---

### 24.4 Atribuição — especificação completa, sem lacuna

**Formato do cookie:**

```
Nome:    ff_attr
Flags:   HttpOnly; Secure; SameSite=Lax; Path=/
Valor:   base64(JSON{ affiliateId, issuedAt, expiresAt }) + "." + HMAC-SHA256(payload, secret)
Max-Age: janela de atribuição (Decisão A: 30 dias) — E o `expiresAt` dentro
         do payload assinado é a fonte de verdade real (Seção 18.2) — o
         `Max-Age` do navegador é só uma camada extra, não a única.
```

**Criação:** em `POST /api/affiliates/click`, depois de confirmar que o
`affiliateId` existe e está `ACTIVE` — mesma rota já existente e pública,
só ganha a responsabilidade de emitir o cookie.

**Persistência entre clique e checkout:** o cookie **é** o mecanismo de
persistência — nada precisa ser gravado no banco entre o clique e a criação
da sessão de checkout (Seção 18.6).

**Resolução no momento do checkout:** `POST /api/stripe/create-subscription`
e `POST /api/mercadopago/create-preference` **param de ler `affiliateId` do
corpo da requisição**. Em vez disso:

1. Leem o cookie `ff_attr` da própria requisição.
2. Verificam a assinatura HMAC — inválida ou ausente = `null` (fail closed).
3. Verificam `expiresAt` dentro do payload — vencido = `null`.
4. Se `User.referredByAffiliateId` **já** está gravado para o usuário
   autenticado fazendo o checkout, usam esse valor (ignoram o cookie —
   atribuição já congelada vence).
5. Caso contrário, usam o `affiliateId` resolvido do cookie (pode ser
   `null`, se não houver cookie válido).
6. Gravam esse valor **resolvido pelo servidor** no metadata da Stripe
   (`subscription.metadata.affiliateId`) ou na `external_reference` do MP —
   mesmos campos usados hoje, mudando só quem escreve neles.

**Congelamento:** no processamento do primeiro `invoice.paid`/
`payment.approved` daquele usuário, o webhook lê o metadata/`external_reference`
resolvido pelo servidor (nunca o corpo de nenhuma requisição do cliente) e,
se `User.referredByAffiliateId` ainda for `null`, grava-o **uma única vez**
(Decisão B — momento exato, sem ambiguidade).

**Last eligible click:** dentro da janela de 30 dias, o cookie mais recente
sempre sobrescreve o anterior — não precisa de lógica especial, é
simplesmente "o cookie que existir no momento do clique subsequente
substitui o `Set-Cookie` anterior".

**Autoindicação — identificadores usados, em ordem de força:**

| # | Identificador | Ação | Força do sinal |
|---|---|---|---|
| 1 | `affiliate.userId === purchasingUser.id` | **Bloqueio automático**, comissão nunca é criada | Forte — match direto de conta |
| 2 | `affiliate.email` (se preenchido) igual a `purchasingUser.email`, comparação case-insensitive | **Bloqueio automático** | Forte — mesmo e-mail, mesmo se o afiliado não vinculou `userId` (afiliado externo) |
| 3 | E-mail do pagamento na Stripe/MP (`customer.email`/payer email) igual a `affiliate.email` | **Log de sinal de fraude, sem bloqueio automático** | Fraco — poderia ser falso positivo (afiliado legitimamente comprando para outra pessoa usando o próprio método de pagamento) |

**Limitações honestas contra fraude multi-conta** (não resolvidas por este
desenho, registradas como dívida de fase 2 — Seção 17): nada aqui impede um
afiliado de criar uma **segunda conta** FlowSara com nome/e-mail diferentes
para comprar através do próprio link. Isso exigiria fingerprint de
dispositivo/cartão — o projeto já tem `trialPaymentFingerprint` reaproveitável
para isso no futuro, mas não está no escopo desta V1.

---

### 24.5 Payout — especificação completa

| Etapa | Quem aciona | O que acontece |
|---|---|---|
| **Solicitação** | Afiliado, `POST /api/affiliate/wallet/payout` | `UPDATE` atômico condicional (Seção 8, via `reserve_payout_amount()`) reserva o valor; se `amount < 100` (Decisão F) ou `amount > availableBalance`, rejeita antes de tocar no banco |
| **Reserva** | Mesma requisição, mesma transação | `PAYOUT_RESERVE` (2 linhas de ledger) + `AffiliatePayout` criado com status `REQUESTED` |
| **Aprovação** | Admin, `POST /api/admin/payouts/:id/approve` | `UPDATE ... WHERE id = $1 AND status = 'REQUESTED'` (ver 24.5.1) — nenhum movimento de ledger (dinheiro já reservado) |
| **Pagamento** | Fora do sistema — admin envia Pix manualmente | Nenhuma ação no FlowSara ainda |
| **Confirmação de pagamento** | Admin, `POST /api/admin/payouts/:id/mark-paid` | `UPDATE ... WHERE id = $1 AND status = 'APPROVED'` + `PAYOUT_SETTLE` (débito final de `RESERVED`) — só executa se a transição de status for aceita |
| **Falha** | Admin, `POST /api/admin/payouts/:id/mark-failed` | `UPDATE ... WHERE id = $1 AND status = 'APPROVED'` + `PAYOUT_RELEASE` (RESERVED→AVAILABLE) — afiliado pode solicitar de novo |
| **Cancelamento** | Afiliado (só se `REQUESTED`) ou admin (a qualquer momento antes de `PAID`) | `UPDATE ... WHERE id = $1 AND status IN (...)` + `PAYOUT_RELEASE` |
| **Idempotência** | Cliente envia `Idempotency-Key` uma vez, reenvia igual em retry | `@@unique([affiliateId, idempotencyKey])` — Seção 6 |
| **Concorrência na criação** | Duas solicitações simultâneas do mesmo afiliado | `UPDATE` atômico condicional no wallet — exatamente 1 sucede (Seção 8, cenário do pedido) |
| **Concorrência na transição de estado** | Dois admins clicando ações diferentes no mesmo payout ao mesmo tempo (ex.: "aprovar" e "rejeitar" simultâneos) | Ver 24.5.1 — mesma família de proteção, aplicada ao próprio `AffiliatePayout.status` |

#### 24.5.1 Toda transição de status é `UPDATE` condicional — não só a criação (item 2 e 10 da revisão adversarial)

A rodada anterior só especificava proteção atômica para a **criação** do
payout (reserva de saldo). Revisando adversarialmente, encontrei a mesma
classe de corrida em **qualquer** transição subsequente: se dois admins (ou
o mesmo admin com duplo clique) chamam `approve` e `reject` no mesmo instante,
sem proteção o sistema poderia processar os dois — liberando a reserva duas
vezes, ou aprovando um payout já rejeitado.

**Correção:** toda rota administrativa de transição usa o mesmo padrão de
`UPDATE` condicionado ao estado **de origem** esperado, nunca um
`SELECT`-depois-`UPDATE`:

```sql
UPDATE "AffiliatePayout"
SET status = 'PAID', "paidAt" = now(), "reviewedBy" = $adminId
WHERE id = $payoutId AND status = 'APPROVED'
RETURNING *;
-- 0 linhas = a transição não é válida a partir do estado atual (já foi PAID,
-- já foi FAILED, etc.) → rota devolve 409, NENHUM movimento de ledger é
-- criado. Só quando a linha É afetada é que o PAYOUT_SETTLE é emitido, na
-- mesma transação.
```

Isso fecha ao mesmo tempo o item 2 (payout duplicado — "confirmar como pago"
duas vezes não duplica o débito, porque a segunda tentativa não encontra o
estado `APPROVED` esperado) e o item 10 (toda corrida de payout, não só a de
criação).

---

### 24.6 Backend — rotas necessárias, especificadas uma a uma

Convenção de path seguindo o que já existe no projeto (`app/api/affiliate/me/*`
singular para self-service, `app/api/admin/*` para administrativo).

#### Rotas novas — self-service do afiliado

**`GET /api/affiliate/wallet`**
- Autenticação: sessão NextAuth obrigatória.
- Autorização: `Affiliate.findFirst({ where: { userId: session.user.id } })` — 404 se o usuário não for afiliado.
- Input permitido: nenhum (sem query params relevantes).
- Dados derivados pelo servidor: `affiliateId` inteiro, nunca do cliente.
- Query: `AffiliateWallet.findUnique({ where: { affiliateId } })`.
- Transaction: não precisa (leitura simples).
- Rate limit: 60/min por usuário (leitura barata, mas ainda limitada).
- Auditoria: não (leitura não é evento de auditoria).

**`GET /api/affiliate/wallet/ledger`**
- Autenticação: sessão.
- Autorização: mesma resolução de `affiliateId` por sessão.
- Input permitido: `cursor`, `limit` (paginação) — nunca `affiliateId`.
- Dados derivados: `affiliateId` da sessão.
- Query: `AffiliateLedgerEntry.findMany({ where: { affiliateId }, orderBy: { createdAt: 'desc' }, take, cursor })`.
- Transaction: não.
- Rate limit: 30/min.
- Auditoria: não.

**`POST /api/affiliate/wallet/payout`**
- Autenticação: sessão.
- Autorização: `affiliateId` resolvido por sessão; `Affiliate.status === 'ACTIVE'` (bloqueado não pode sacar).
- Input permitido: `{ amount, idempotencyKey }` — **nada mais**.
- Dados derivados: `affiliateId` (sessão), `pixKey` (do cadastro do afiliado, não do corpo — evita que o cliente redirecione o Pix para outra chave no ato do saque).
- Query/Transaction: `withTenantTx` com o `UPDATE` atômico condicional (Seção 8) + `INSERT` em `AffiliatePayout` + 2× `INSERT` em `AffiliateLedgerEntry`, tudo na mesma transação.
- Rate limit: 5/min (ação sensível, baixo volume esperado legitimamente).
- Auditoria: sim — `affiliate.wallet.payout_requested`, com `amount`, `payoutId`.

**`POST /api/affiliate/wallet/payout/:id/cancel`**
- Autenticação: sessão.
- Autorização: a posse (`affiliateId` da sessão) **e** o estado esperado são
  verificados na mesma operação atômica — `UPDATE "AffiliatePayout" SET
  status = 'CANCELLED' WHERE id = $1 AND "affiliateId" = $2 AND status =
  'REQUESTED' RETURNING *` (Seção 24.5.1). 0 linhas afetadas cobre os dois
  casos de erro (não pertence ao usuário, ou não está mais cancelável) sem
  distinguir qual — evita um oráculo que revelasse "existe mas não é seu" vs.
  "não existe".
- Input permitido: nenhum campo de corpo (só o `:id` no path).
- Query/Transaction: `PAYOUT_RELEASE`, mesma transação do `UPDATE` acima.
- Rate limit: 10/min.
- Auditoria: sim — `affiliate.wallet.payout_cancelled`.

#### Rotas novas — administrativas

Todas com autenticação = sessão + autorização = `requireAdmin()` (helper já existente e auditado).

**`GET /api/admin/affiliates`** — lista + filtro por status; input: `status`, `search`, paginação; sem transaction; rate limit 30/min; sem auditoria (leitura).

**`GET /api/admin/affiliates/:id/ledger`** — ledger completo de qualquer afiliado; input: paginação; sem transaction; rate limit 30/min; sem auditoria.

**`POST /api/admin/affiliates/:id/adjust`** — input: `{ account, amount, reason }`, `reason` **obrigatório** (rejeita sem); dados derivados: `createdBy` = admin da sessão; transaction: `withTenantTx` com `INSERT` em ledger + atualização do wallet; rate limit 10/min; auditoria **sim, sempre** — `affiliate.commission.adjusted`, com valor, motivo, saldo antes/depois.

**`POST /api/admin/affiliates/:id/block`** — input: nenhum campo além do path; muda `Affiliate.status = BLOCKED`; sem transaction complexa; rate limit 10/min; auditoria sim — `affiliate.blocked`.

**`GET /api/admin/payouts`** — fila de payouts, filtro por status; sem transaction; rate limit 30/min; sem auditoria.

**`POST /api/admin/payouts/:id/approve`** — `UPDATE ... WHERE id = $1 AND status = 'REQUESTED'` (Seção 24.5.1) — 0 linhas afetadas = 409, sem tocar ledger; rate limit 20/min; auditoria sim — `affiliate.wallet.payout_approved`.

**`POST /api/admin/payouts/:id/mark-paid`** — input: nenhum; `UPDATE ... WHERE id = $1 AND status = 'APPROVED'` + `PAYOUT_SETTLE` (idempotente via `payout-settle:${payoutId}`, Seção 6), tudo na mesma transação `withTenantTx`; rate limit 20/min; auditoria sim — `affiliate.wallet.payout_paid`, valor, `paidAt`.

**`POST /api/admin/payouts/:id/mark-failed`** — input: `{ failureReason }`; `UPDATE ... WHERE id = $1 AND status = 'APPROVED'` + `PAYOUT_RELEASE`, mesma transação; rate limit 20/min; auditoria sim.

**`POST /api/admin/payouts/:id/reject`** — input: `{ reason }` obrigatório; `PAYOUT_RELEASE` + flag para revisão de fraude; transaction; rate limit 20/min; auditoria sim.

#### Rotas existentes que mudam de comportamento (não são novas, mas o contrato muda)

**`POST /api/stripe/create-subscription`** — para de ler `affiliateId` do corpo (Seção 24.4); resto do contrato inalterado.

**`POST /api/mercadopago/create-preference`** — idem; `couponCode` continua aceito só para desconto, não mais para atribuição.

**`POST /api/stripe/webhook`** — ganha o processamento de `invoice.paid` → criação de comissão (Seção 24.3), dentro do handler já existente e já protegido por assinatura + dedup.

**`POST /api/webhooks/mercadopago`** — ganha o mesmo processamento para `payment.approved`, **mais** o branch `charged_back` que hoje não existe (achado da Seção 4.4).

#### Jobs (não são rotas HTTP de usuário, mas precisam de especificação)

**`cron/affiliate-maturation`** — `GET`/`POST` protegido por `CRON_SECRET` (mesmo padrão de `cron/alerts`); busca `AffiliateCommission` com `status = PENDING AND maturesAt <= now()`; para cada uma, `COMMISSION_MATURE` idempotente (`mature:${commissionId}`).

**`cron/affiliate-reconcile`** — mesmo padrão; recalcula `SUM(ledger)` por afiliado/conta, compara com `AffiliateWallet`, **só alerta**, nunca corrige sozinho (Seção 3.1).

---

### 24.7 Frontend — regras explícitas, sem exceção

O frontend:
- **Nunca calcula saldo como autoridade** — exibe exatamente o que `GET /api/affiliate/wallet` devolve, sem soma/subtração local que vire fonte de decisão (pode formatar/exibir, nunca decidir se um saque é possível).
- **Nunca define comissão** — não existe campo de comissão editável em nenhuma tela.
- **Nunca define `affiliateId`** — o código de afiliado (`?ref=`) só é usado para exibir "você foi indicado por X" na UI; nunca é enviado de volta ao servidor como prova de atribuição.
- **Nunca define status** — nenhuma tela de admin tem um seletor genérico de status de payout; cada ação é um botão que chama o endpoint de verbo específico (Seção 7/24.6).
- **Nunca define percentual** — `commissionPercent`/`discountPercent` só são editáveis via rota administrativa própria (fora do escopo desta V1 de carteira — hoje já são definidos na criação do afiliado).
- **Apenas solicita ações e exibe respostas do backend** — todo botão financeiro (solicitar saque, cancelar saque, aprovar payout) dispara um `POST` para um endpoint específico e renderiza a resposta; nenhuma tela pré-calcula o resultado antes do servidor confirmar.

---

### 24.8 Matriz de testes obrigatória

Convenção: testes de integração reais contra banco/app rodando, mesmo padrão
de `__tests__/rls.test.ts` e `__tests__/webhook-failclosed.test.ts`.

| # | Caso | Mecanismo exercitado | Resultado esperado |
|---|---|---|---|
| 1 | IDOR — afiliado A lê carteira/ledger/payout de B | `GET /wallet`, `GET /wallet/ledger` com sessão de A, tentando IDs de B | 404, nunca 200 com dado de B |
| 2 | Self-referral direto | Compra usando o próprio `userId` vinculado ao afiliado | Comissão não é criada; log de sinal de fraude |
| 3 | Self-referral por e-mail | Compra com conta de e-mail igual ao `affiliate.email`, `userId` diferente | Comissão não é criada |
| 4 | `affiliateId` spoofing no checkout | `POST create-subscription`/`create-preference` com `affiliateId` forjado no corpo | Campo ignorado; atribuição vem só do cookie |
| 5 | Manipulação de `amount` no saque | `POST payout` com `amount` maior que o disponível | 0 linhas afetadas no `UPDATE` condicional → rejeitado, nenhum payout criado |
| 6 | Manipulação de `commission`/`percentage` | Corpo de qualquer rota tentando setar esses campos | Ignorados — nenhuma rota os aceita como input |
| 7 | Webhook duplicado (Stripe) | Mesmo `event.id` reenviado | `claimStripeEvent` bloqueia; nenhuma comissão duplicada |
| 8 | Webhook duplicado (MP) | Mesma chave `${payment.id}:${status}` reenviada | `claimMercadoPagoEvent` bloqueia |
| 9 | Webhook fora de ordem | `invoice.paid` antigo chega depois de um evento mais novo | Criação de comissão é idempotente por `invoice.id` — não duplica independente da ordem |
| 10 | Comissão duplicada | Dois processamentos concorrentes do mesmo `invoice.paid` | `AffiliateCommission.saleId @unique` rejeita o segundo com P2002, tratado como no-op |
| 11 | Payout duplicado | Duplo clique em "solicitar saque" com a mesma `idempotencyKey` | `@@unique([affiliateId, idempotencyKey])` — só 1 payout criado |
| 12 | Duas solicitações simultâneas | Dois `POST /payout` de R$100 contra saldo de R$100, via `Promise.all` | Exatamente 1 sucede; o outro recebe "saldo insuficiente"; saldo final bate com o ledger |
| 13 | Saldo insuficiente | `POST /payout` com `amount` acima do disponível, sem concorrência | Rejeitado antes de criar qualquer registro |
| 14 | Refund total | `charge.refunded` completo sobre uma comissão `AVAILABLE` | `COMMISSION_REVERSE` completo; status `REVERSED` |
| 15 | Refund parcial | `charge.refunded` parcial | Reversão proporcional (Decisão B da rodada anterior — confirmar valor final) |
| 16 | Chargeback | `charge.dispute.created` (Stripe) e `charged_back` (MP, achado novo) | Ambos revertem a comissão; MP especificamente testado porque hoje não trata esse status |
| 17 | Renovação | Segundo `invoice.paid` da mesma assinatura, meses depois, sem clique novo | Nova comissão criada, mesmo afiliado da atribuição original (lida de `User.referredByAffiliateId`, não de clique) |
| 18 | Isolamento entre afiliados | Afiliado A não vê nome/e-mail/saldo de B em nenhuma resposta | Testado via todas as rotas de self-service com sessão de A |
| 19 | Isolamento multi-tenant | Mesmo princípio aplicado a `User`/tenant, não só `Affiliate` | RLS + ownership redundantes (Seção 14) |
| 20 | Alterar status pelo frontend | `PATCH`/`POST` tentando setar `status` de payout diretamente | Rota não existe para o afiliado; para admin, endpoint de verbo específico ignora `status` no corpo |
| 21 | Replay de request | Reenvio do mesmo `POST /payout` com a mesma `idempotencyKey` depois do payout já `PAID` | Retorna o payout já existente, não cria um novo nem reserva saldo de novo |
| 22 | Replay de webhook | Reenvio de um `invoice.paid` já processado dias depois | Bloqueado por `claimStripeEvent` E por `AffiliateSale.@@unique([processor, externalPaymentId])` — dupla camada testada separadamente |

---

### 24.9 Revisão adversarial final — os 18 cenários, um a um

Pedido explícito: revisar o schema antes da primeira migration e, se
encontrar problema, **corrigir o documento, não o código**. É isso que este
checklist registra — todos os 6 ajustes reais encontrados já foram aplicados
nas seções acima (24.1, 24.2, 24.3, 24.5, 24.6); aqui fica o veredito
consolidado de cada um dos 18 pontos, para você conferir de uma vez.

| # | Cenário | Veredito | Onde foi corrigido (se foi) |
|---|---|---|---|
| 1 | Comissão duplicada | 🟡 **Gap encontrado e corrigido** — faltava exigir que `AffiliateSale`+`AffiliateCommission`+ledger nascessem na mesma transação; sem isso, uma falha parcial deixaria venda órfã sem comissão, e a idempotência (que verifica "a venda já existe") esconderia esse buraco para sempre | Seção 24.2 (nova regra de atomicidade) |
| 2 | Payout duplicado | 🟡 **Gap encontrado e corrigido** — a especificação anterior só protegia a *criação*; `mark-paid` chamado duas vezes não tinha proteção própria contra corrida | Seção 24.5.1 (todas as transições viram `UPDATE` condicional) |
| 3 | Saldo divergente do ledger | 🟡 **Decisão pendente da rodada anterior, resolvida agora** — troquei a recomendação de "disciplina de código" para funções `SECURITY DEFINER`, atendendo ao seu pedido explícito de reforçar o banco | Seção 24.1 (bloco de funções + `REVOKE` de coluna) |
| 4 | Comissão criada sem pagamento legítimo | ✅ **Já protegido, agora confirmado por escrito** — nenhuma rota HTTP cria `AffiliateCommission`; só o processamento de webhook | Seção 24.3, linha "Quando nasce" |
| 5 | Payout criado sem saldo `AVAILABLE` | 🟢 **Já protegido (Seção 8); reforçado com CHECK de banco** para o mínimo de R$100, que antes só existia como validação de rota | Seção 24.1 (`CHECK payout_amount_minimum`) |
| 6 | Afiliado alterar o próprio percentual | ✅ **Já impossível** (nenhuma rota deste projeto expõe esse campo); **reforçado com `CHECK` de faixa 0-100** contra qualquer caminho futuro | Seção 24.1 (`CHECK affiliate_commission_percent_range`) |
| 7 | Frontend escolher `affiliateId` | ✅ Já coberto (Seção 18/24.4) — sem mudança nesta passada | — |
| 8 | Frontend escolher `commissionId` | ✅ **Confirmado, nenhuma rota aceita esse campo** — comissões são só-leitura para qualquer cliente | Seção 24.3, linha nova "Quem pode ler comissões individuais" |
| 9 | Frontend escolher `payoutId` de outro afiliado | ✅ Já coberto por ownership; **reforçado** para não vazar "existe mas não é seu" vs "não existe" | Seção 24.6, rota de cancelamento |
| 10 | Race condition em payout | 🟡 **Gap encontrado e corrigido** — mesma causa raiz do item 2 | Seção 24.5.1 |
| 11 | Webhook duplicado | ✅ Já coberto (dedup de transporte + constraint de domínio) — sem mudança | — |
| 12 | Webhook fora de ordem | 🟡 **Dois gaps encontrados e corrigidos** — (a) corrida entre maturação e reversão na mesma comissão; (b) reversão chegando antes da venda existir | Seção 24.2 |
| 13 | Refund/chargeback gerando reversão duplicada | 🟡 **Ambiguidade corrigida** — a chave de idempotência usava linguagem que podia ser confundida com o `event.id` do webhook (já deduplicado noutra camada); precisava ser explicitamente o id do **objeto** de reembolso/disputa | Seção 6 |
| 14 | IDOR entre afiliados | ✅ Já coberto extensivamente — sem gap novo | — |
| 15 | IDOR entre usuários/tenants | ✅ Confirmado — nenhuma rota nova deste projeto expõe `referredByAffiliateId` ou dado de outro usuário | — |
| 16 | Alteração de registros financeiros históricos | 🟡 **Gap real encontrado** — o `REVOKE` da rodada anterior só cobria `AffiliateLedgerEntry`; `AffiliateSale` (fato) não tinha proteção nenhuma, e `AffiliateCommission` precisava de `REVOKE` **em nível de coluna** (só `status` pode mudar) | Seção 24.1 |
| 17 | `DELETE` de registros financeiros históricos | 🟡 **Gap real encontrado** — faltava `REVOKE DELETE` em `AffiliateSale`, `AffiliateCommission`, `AffiliatePayout`, `AffiliateWallet` (só o ledger estava protegido) | Seção 24.1 |
| 18 | `Float` em campo monetário relevante | ✅ Confirmado — todo o schema novo (24.1) já usa `Decimal` em 100% dos campos financeiros | — |

**Sobre a exigência adicional da Decisão E** (histórico nunca "corrigido"
artificialmente, clawback vira nova movimentação, nunca edição): já é
exatamente o que o desenho fazia desde a rodada anterior — `COMMISSION_REVERSE`
é sempre uma **nova** linha de ledger, nunca uma edição da linha
`COMMISSION_ACCRUE` original, e isso agora tem o `REVOKE UPDATE` em
`AffiliateSale`/`AffiliateLedgerEntry` como garantia estrutural, não só de
convenção. O exemplo do seu pedido (`+R$44,10` → `-R$44,10` payout →
`-R$44,10` clawback, três linhas distintas, nenhuma apagada) é literalmente
o que a Seção 2.3 (reconstrução do saldo a partir do ledger) já garante.

**Resultado da revisão: 6 gaps reais encontrados, todos corrigidos no
documento (não no código, como pedido). Nenhum deles era uma falha na regra
de negócio já aprovada (Seção 23) — todos eram lacunas de especificação
técnica (transação, corrida, granularidade de `REVOKE`), exatamente o tipo
de coisa que essa revisão existia para pegar antes da migration.**

---

**Nada neste documento foi implementado.** Schema, migrations, rotas e
frontend seguem exatamente como estavam antes desta análise e das anteriores.
A revisão adversarial (24.9) está concluída e os 6 gaps encontrados foram
corrigidos no documento. Prosseguindo agora para a Fase 1 (schema +
migration), conforme autorizado.
