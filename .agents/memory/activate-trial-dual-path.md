---
name: activate-trial dual-path
description: Arquitetura da tela /activate-trial com 3 caminhos (cartão, explorar, Pix à vista) quando o usuário quer trial opcional + compra direta.
---

A tela `/activate-trial` neste projeto foi bifurcada em três caminhos a partir do mesmo ponto de entrada, evitando auto-construir a assinatura Stripe no mount.

**Três caminhos, mesma rota:**

1. **Cartão + trial 7 dias (Stripe)** — `setStep('card')` + `startCardFlow()`. Cria `Stripe.subscriptions.create` com `trial_period_days=7`, gera `clientSecret` para o Stripe Elements, exige cartão válido em `/api/stripe/activate-trial` (Fail-closed, ver `stripe-trial-card-required`). Esta é a única via que dispara Meta CAPI `StartTrial`.

2. **Explorar sem cartão (no-card trial)** — endpoint dedicado `/api/stripe/explore-trial` que grava `trialStatus='active'`, `trialPlan`, `trialEndsAt` direto no DB. **Não** cria subscrição Stripe, **não** marca `paymentMethodAddedAt`, **não** dispara Meta CAPI. Redireciona direto para `/dashboard`. Bloqueado em 409 quando `paymentMethodAddedAt !== null` (anti-fraude: quem já vinculou cartão não pode usar essa porta para reentrar no trial).

3. **Pagamento à vista Pix (Mercado Pago)** — `<Link href="/checkout?plan=X">` puro, sem JS. A página `/checkout` já cria preferência MP com PIX/boleto/cartão; o webhook `/api/webhooks/mercadopago` faz upgrade do plano quando o pagamento é confirmado.

**UX no choose-screen (default state):**

- Botão primário (gradiente azul→roxo): "Adicionar cartão e ativar teste" → caminho 1
- Botão secundário (branco/borda): "Conhecer a plataforma primeiro" → caminho 2
- Botão terciário (ciano, link direto): "Pagar agora com Pix" → caminho 3

**Por que separar:**

- Card-required é regra de negócio firme (trial_settings.end_behavior.missing_payment_method='cancel' na Stripe) — pular exige endpoint dedicado que escreve direto no DB.
- MP é totalmente fora do Stripe: usar `<Link>` evita reescrever a tela e reusa o checkout existente que já trata CPF, polling de PIX, success/failure/pending.
- O estado `step` controla qual subtree JSX mostrar — não fica nada escondido, tudo visível no React tree para facilitar debug.

**Why:** Dar poder de escolha sem comprometer regras de cobrança (cartão obrigatório para tirar proveito do trial do Stripe, mas permitindo explorar primeiro via DB ou comprar à vista com Pix).

**How to apply:** Quando o usuário pedir "explorar a plataforma antes de pagar" sem mexer na regra de card-required do Stripe, não tente afrouxar o Stripe — adicione um endpoint que grava trial direto no DB e bloqueie com `paymentMethodAddedAt` check. Quando pedir "Pix à vista", não duplica checkout; aponta para `/checkout?plan=X` que já tem fluxo MP completo.
