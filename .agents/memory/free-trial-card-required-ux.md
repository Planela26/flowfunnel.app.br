---
name: free-trial-card-required-ux
description: Em produtos SaaS, "teste grátis" só conta como realmente grátis se houver cartão cadastrado. Sem cartão, é só modo "explorar" — não unlock de features.
---

A peça mais fina da UX comercial: o copy precisa ser honesto sobre a natureza do trial.

**Regra:** "Teste grátis" implica trial financeiro — pode cancelar antes da cobrança. Sem cartão cadastrado na Stripe (User.paymentMethodAddedAt = null), não há trial financeiro de verdade; é só uma janela de exploração. O usuário ainda vê o funil, mas não pode gravar integração real nem webhook fica bloqueado.

**Padrão aplicado (jun/2026):**

1. `hasPaidAccess(user)` — hoje em `lib/commercial-access.ts` (nasceu em `lib/trial.ts`; ver a seção do fim).
2. `app/api/plan/route.ts` expõe `cardAdded`, `paidAccess`, `exploringOnly` no `PlanInfo`.
3. `components/TrialBanner.tsx` tem 3 ramos:
   - Plano pago (Stripe mensal ou PIX MP aprovado): banner verde "Plano X ativo — recursos liberados imediatamente."
   - Trial com cartão: copy original com dias restantes + "Assinar agora".
   - Sem cartão: banner cinza "Você está conhecendo a plataforma — N dias pra decidir. Adicione cartão (7 dias grátis) ou pague via PIX." (sem "teste grátis").
4. `lib/integration-gate.ts` exporta `assertCanCreateIntegration(request)`, chamado pelos 7 POSTs em `app/api/integrations/{meta,whatsapp,eduzz,hotmart,kiwify,monetizze,perfect-pay}/route.ts` e pelo `app/api/whatsapp/qr-stream/route.ts`, logo após auth + rate-limit.
5. PIX (MercadoPago) já ativa `subscriptionStatus='active'` no webhook (`app/api/webhooks/mercadopago/route.ts`), então passa pelo gate automaticamente — recursos liberados imediatamente na tier paga.

**Why:** O copy "7 dias restantes no Plano PRO" sem cartão criava expectativa falsa (usuário achava que tinha um trial financeiro). Pior: como o gate não existia, usuário podia conectar Meta Ads no modo exploração e ficar frustrado quando webhook não batia. Marketing compliance + UX coerente são o mesmo problema.

**How to apply:** Em qualquer SaaS que ofereça trial com cartão, separar claramente "explorar" (livre, sem cartão) e "trial financeiro" (cartão, cancellable). O copy (`TrialBanner`) continua sendo o lugar certo para essa honestidade.

## Correção de ago/2026 — o gate ficou, o `card_required` saiu

O bloqueio estava certo; a **classificação** estava errada. Um único código,
`card_required`, cobria motivos incompatíveis, e a mensagem que o acompanhava
("Você está conhecendo a plataforma. Adicione um cartão") era falsa para quase
todos eles:

| Situação real | Recebia | Devia receber |
|---|---|---|
| Pagou PIX, venceram os 30 dias | `card_required` | `plan_expired` → renovar |
| Conta administrativa | `card_required` | acesso liberado |
| Conta desativada | `card_required` | `account_deactivated` |
| Nunca assinou, sem cartão | `card_required` | `subscription_required` |

**O que mudou:**

1. `lib/commercial-access.ts` (novo) — `resolveCommercialAccess(user)` devolve
   `{allowed, reason}` ou `{allowed:false, code, message, actionUrl, status}`.
   Compõe `plan-expiry` + `subscription` + `trial`, sem duplicar regra.
   `hasPaidAccess` mudou de casa para cá e virou `.allowed` do mesmo resolvedor.
2. `role` ∈ {ADMIN, OWNER} libera — por PAPEL, nunca por e-mail. Sem isso a conta
   fundadora não conectava a própria Meta Ads, e o Laboratório (que cruza custo e
   ROAS a partir dessa integração) ficava sem fonte.
3. Suspensão é avaliada ANTES do papel: conta desativada não se contorna por role.
4. `plan_expired` × `subscription_required` separam "tinha e venceu" (renovar) de
   "não tem" (assinar). `past_due`/`expired` → renovar; `cancelled`/`refunded`/
   `disputed` → assinar de novo.
5. O middleware ganhou `message` junto do código em `account_deactivated` e
   `plan_expired` (middleware.ts) — ele responde ANTES do gate nesses dois casos,
   e mandava só o identificador.

**A armadilha que produziu o bug visível:** `app/facebook-connect/page.tsx` fazia
`throw new Error(data.error || ...)`, lendo o campo da MÁQUINA. Por isso a tela
mostrou a string `card_required` crua. Resposta de erro com `error` + `message`
precisa ser consumida como `data.message || data.error`, sempre.

**Lição:** predicado booleano é o formato errado para autorização comercial. Um
`false` não carrega o motivo, então todo caller inventa a própria mensagem — e a
inventa errada para os estados que não imaginou. Devolva código semântico desde
a origem, e faça tela e gate lerem a MESMA função (`/api/plan` e
`integration-gate` hoje chamam `resolveCommercialAccess`; era a divergência entre
os dois que deixava a UI dizer "explorando" para quem tinha pagado).

**Não confundir com a Meta:** a Graph API tem um erro próprio chamado
`card_required`, sobre meio de pagamento DA CONTA DE ANÚNCIOS. Como o FlowSara
não emite mais esse código em lugar nenhum, `card_required` na interface agora
significa, sem ambiguidade, que veio da Meta.

## A brecha do `paymentMethodAddedAt` (mesma leva)

`paymentMethodAddedAt` é gravado uma vez e NUNCA é limpo — nenhuma rota zera
essa coluna. Sozinho isso não seria problema; virou problema por causa da
pergunta que o resolvedor fazia:

```ts
if (!paymentMethodAddedAt) bloqueia
if (trialEndsAt && isTrialExpired(u)) bloqueia   // ← pergunta errada
libera
```

`isTrialExpired` responde "o teste VENCEU?", e `false` aí não significa "tem
direito" — significa "não é comprovadamente vencido". Estes estados devolvem
`false` sem serem teste nenhum: `pending_payment`, `pending_email`,
`converted`, `none` sem `trialPlan`, `plan` diferente de FREE, e qualquer conta
com `trialEndsAt` nulo (que nem chega a ser avaliada, pela guarda `&&`).

Resultado medido: **7 de 7 estados sem direito comercial ganhavam acesso
permanente** — bastava ter cadastrado um cartão um dia.

**Correção:** trocar pelo predicado POSITIVO `isTrialActive` (que exige
`trialEndsAt` no futuro e teste de fato em curso, e já era o usado por
`getEffectivePlan`), e checá-lo ANTES do cartão. Assim o cartão apenas
qualifica um direito que já existe, e nunca cria um sozinho:

```ts
if (!isTrialActive(u)) bloqueia         // acabou, ou nunca houve
if (!paymentMethodAddedAt) bloqueia     // teste em curso, mas modo explorar
libera
```

**Lição:** para autorizar, pergunte pelo positivo ("tem direito?"), nunca pelo
negativo ("perdeu o direito?"). O negativo trata todo estado desconhecido como
permissão — e estado desconhecido é o caso comum em coluna que acumula valores
históricos e nunca é limpa.

## Um bloqueio, um banner

`PlanExpiredBanner` e `TrialBanner` chegaram a mostrar avisos simultâneos e
contraditórios ("Seu plano está vencido" × "Seu teste grátis terminou") para a
mesma conta, porque liam fontes diferentes. Divisão atual:

- **`TrialBanner`** — plano pago ativo, ou teste EM CURSO (com e sem cartão).
- **`PlanExpiredBanner`** — todo o resto: qualquer `accessDenialCode`, desde que
  não haja teste em curso. Texto e destino vêm prontos de `/api/plan`.

Ambos leem `usePlan()`; `PlanExpiredBanner` deixou de consultar
`/api/subscription/status` e de montar a própria frase.
