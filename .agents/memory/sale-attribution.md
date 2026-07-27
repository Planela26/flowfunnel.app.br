---
name: Sale attribution engine
description: How FlowFunnel links sales to original clicks — deterministic vs probabilistic rules and the security boundary of public pixel endpoints.
---

## Rules
- Attribution lives in `lib/attribution.ts` (engine) + `lib/journey.ts` (queries). Priority: checkout-param lead_id (Hotmart `sck`, Kiwify `s1`, Eduzz `utm_content`, Monetizze/Perfect Pay `src`, Stripe `client_reference_id`) → thank-you-page order match → email/phone → 24h time-window → unmatched. Deterministic never downgraded.
- **Why (security):** `/api/track/event` and `/api/track/conversion` are public pixel endpoints keyed only by `site=userId`. Therefore the thank-you page must NEVER create revenue/attribution rows — it may only PROMOTE a sale already confirmed by an authenticated platform webhook. Webhook-first and thank-you-first orders both converge via TrackedConversion lookup (A.2).
- **How to apply:** any new checkout platform must (a) get its native tracking param added to `nativeTrackingParam()` in `public/tracker.js`, and (b) pass `trackingParams` to `attributeSale` in its webhook handler. Reconciliation lookups must be platform-strict (or single-candidate) — never platform-agnostic findFirst on transactionId (code review caught duplicate/cross-platform corruption).
- lead_id format is `l_<ts36>_<rand>`; extraction regex in attribution tolerates it embedded in composite param values.
