---
name: free-trial-card-required-ux
description: Em produtos SaaS, "teste grátis" só conta como realmente grátis se houver cartão cadastrado. Sem cartão, é só modo "explorar" — não unlock de features.
---

A peça mais fina da UX comercial: o copy precisa ser honesto sobre a natureza do trial.

**Regra:** "Teste grátis" implica trial financeiro — pode cancelar antes da cobrança. Sem cartão cadastrado na Stripe (User.paymentMethodAddedAt = null), não há trial financeiro de verdade; é só uma janela de exploração. O usuário ainda vê o funil, mas não pode gravar integração real nem webhook fica bloqueado.

**Padrão aplicado (jun/2026):**

1. `lib/trial.ts` ganhou `hasPaidAccess(user)` — true se `subscriptionStatus === 'active'` OU `paymentMethodAddedAt !== null`. Usado como single source of truth.
2. `app/api/plan/route.ts` expõe `cardAdded`, `paidAccess`, `exploringOnly` no `PlanInfo`.
3. `components/TrialBanner.tsx` tem 3 ramos:
   - Plano pago (Stripe mensal ou PIX MP aprovado): banner verde "Plano X ativo — recursos liberados imediatamente."
   - Trial com cartão: copy original com dias restantes + "Assinar agora".
   - Sem cartão: banner cinza "Você está conhecendo a plataforma — N dias pra decidir. Adicione cartão (7 dias grátis) ou pague via PIX." (sem "teste grátis").
4. `lib/integration-gate.ts` exporta `assertCanCreateIntegration(request)` que retorna 402 com `code: 'CARD_REQUIRED_TO_LINK_INTEGRATION'` se `hasPaidAccess(user) === false`. Os 7 POSTs em `app/api/integrations/{meta,whatsapp,eduzz,hotmart,kiwify,monetizze,perfect-pay}/route.ts` chamam logo após auth + rate-limit.
5. PIX (MercadoPago) já ativa `subscriptionStatus='active'` no webhook (`app/api/webhooks/mercadopago/route.ts`), então passa pelo gate automaticamente — recursos liberados imediatamente na tier paga.

**Why:** O copy "7 dias restantes no Plano PRO" sem cartão criava expectativa falsa (usuário achava que tinha um trial financeiro). Pior: como o gate não existia, usuário podia conectar Meta Ads no modo exploração e ficar frustrado quando webhook não batia. Marketing compliance + UX coerente são o mesmo problema.

**How to apply:** Em qualquer SaaS que ofereça trial com cartão, separar claramente "explorar" (livre, sem cartão) e "trial financeiro" (cartão, cancellable). O gate de mutação real (criar integração, criar assinatura, cobrar) deve usar `hasPaidAccess(user)` como predicado único — nunca ler `trialStatus` direto nas rotas de feature.
