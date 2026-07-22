---
name: Meta tracking architecture
description: Como o rastreamento Meta (CAPI + Pixel) está implementado no FlowFunnel — dedup, timing, race fixes.
---

# Meta tracking — CAPI + Pixel

## Regra geral
Cada evento usa um `event_id` determinístico compartilhado entre CAPI (server-side) e Pixel (browser-side). O Meta deduza automaticamente. CAPI é o canal confiável; Pixel é best-effort.

## event_ids por evento
| Evento | event_id |
|---|---|
| Purchase (Stripe) | `purchase_<invoice.id>` |
| Purchase (MP) | `purchase_mp_<payment.id>` |
| CompleteRegistration | `reg_<userId>` |
| StartTrial | `trial_<userId>` |

## StartTrial — timing correto
**StartTrial NÃO deve disparar no signup.** Dispara APENAS em `/api/stripe/activate-trial` (quando `trialStatus='active'` com cartão confirmado). O register retorna apenas `completeRegistration` no `meta`. O `activate-trial` retorna `meta.startTrial.{eventId,value,currency}` para o Pixel client-side.

**Why:** "StartTrial" = trial ativado com cartão; ao signup o usuário só expressou intenção (trialStatus='pending_email').

## MP embedded checkout — Purchase Pixel
O fluxo embedded MP NÃO visita `/checkout/success`. O Pixel Purchase dispara DIRETAMENTE no `PaymentBrickCheckout`:
- Card inline: `result.status === 'approved'` → `fireMetaPurchase(result.id, d.amount)`
- PIX polling: `data.status === 'approved'` → `fireMetaPurchase(paymentId, dataRef.current.amount)`

**Why:** CelebrationScreen é mostrado in-place; success page polling não é alcançada.

## Success page race fix
A success page deve verificar `typeof window.fbq === 'function'` ANTES de consumir `/api/meta/purchase`. O endpoint limpa `metaPurchase` no banco ao ler — se fbq não estiver pronto, o evento seria perdido.

## Graceful no-op
`lib/meta-capi.ts` retorna sem erro se `META_ACCESS_TOKEN` não estiver configurado (apenas warn no console). Os dois Pixels estão hardcoded em `lib/meta-pixels.ts`.

## META_ACCESS_TOKEN
Precisa ser configurado manualmente em Replit Secrets. Até lá, CAPI fica silencioso; Pixel continua funcionando.
