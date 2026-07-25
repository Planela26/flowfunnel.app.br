---
name: mp-payment-overrides-stripe-state
description: Pagamento PIX via MercadoPago seta User.subscriptionStatus='active' independente da Stripe. UI precisa refletir isso, não o que a Stripe diz.
---

Quando o usuário paga via PIX (MercadoPago), o webhook `app/api/webhooks/mercadopago/route.ts` faz `prisma.user.update({ plan: planKey, subscriptionStatus: 'active', gracePeriodEndsAt: null })` direto no banco. Mas:

- O `User` ainda pode ter um `stripeSubscriptionId` órfão apontando pra uma subscription em estado `'trialing'` quando o usuário tentou o trial com cartão antes e desistiu.
- A UI `/api/stripe/subscription` lia `subscription.status` direto da Stripe e mostrava "Em trial / próxima renovação 01/08" mesmo após pagamento confirmado.

**Regra:** qualquer endpoint de billing/UX que mostra status ao usuário precisa preferir `User.subscriptionStatus` (que vem do nosso banco e reflete pagamento confirmado por qualquer canal) sobre `subscription.status` da Stripe.

**Padrão aplicado (jun/2026)** em `app/api/stripe/subscription/route.ts`:

1. Selecionar também `subscriptionStatus` e `gracePeriodEndsAt` no query do usuário.
2. Quando `user.subscriptionStatus === 'active'` retornar `status: 'active'` (sintetizado, com `id: 'mercadopago'` se não houver Stripe sub) antes de qualquer leitura de Stripe.
3. Quando `subscription.status === 'trialing'` e `user.trialStatus !== 'active'` → status `'free'` (não inventar trial sem cartão).

**Why:** Esse é um caso clássico em SaaS com múltiplos PSPs. Cada PSP tem sua própria "verdade" sobre o estado da assinatura, e a UI precisa de uma única fonte — o banco do produto, não o gateway. Caso contrário aparecem relatos como "paguei e o sistema diz que estou em trial".

**How to apply:** Quando adicionar novo PSP (Kiwify, PerfectPay, etc), o mesmo padrão se aplica: webhook seta `User.subscriptionStatus='active'`, e o `SubscriptionCard`/`/api/stripe/subscription` (e qualquer endpoint de billing exposto ao user) consulta o banco PRIMEIRO. Se quiser, generalize pra um helper `getBillingSummary(user)` em `lib/billing.ts` que decida o status final e a data de próxima cobrança baseado em cada PSP.
