---
name: Stripe card-required trial
description: How to force a credit card before a Stripe free trial starts, and why a trial can leak open without one.
---

# Stripe card-required free trials

To require a card BEFORE a free trial activates, a trialing
`subscriptions.create` MUST set
`trial_settings.end_behavior.missing_payment_method: 'cancel'`.

**Why:** Without it, Stripe defaults `missing_payment_method` to
`create_invoice`, treating the card as OPTIONAL. In that mode Stripe may NOT
create a `pending_setup_intent`, so a checkout page that branches on
"no setup intent => already has a payment method" will auto-activate a trial
with NO card on file. This silently leaked open trials (users got an active
trial + plan without ever entering a card).

**How to apply:**
- Always set `missing_payment_method: 'cancel'` on trial subscriptions that
  must collect a card.
- `subscriptions.list(...)` does NOT expand `pending_setup_intent`; re-retrieve
  with `expand: ['pending_setup_intent']` to read its `client_secret`.
- Fail-closed on activation: before granting the trial, confirm a real card
  exists — `default_payment_method.type === 'card'` OR
  `stripe.paymentMethods.list({ customer, type: 'card' }).data.length > 0`.
  Accepting any payment-method object (not specifically a card) is a hole.
- In webhooks, treat `customer.subscription.created` with status `trialing`
  like `incomplete`: store the subscription id but do NOT grant the paid plan.
  Grant the plan only on conversion (`subscription.updated` trialing->active)
  or `invoice.paid`.
