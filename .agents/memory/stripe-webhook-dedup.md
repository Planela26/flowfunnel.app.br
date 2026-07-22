---
name: Stripe webhook dedup
description: Correct deduplication semantics for the Stripe webhook handler.
---

Stripe event dedup must be **persistent** and preserve **at-least-once** delivery.

**Rule:**
- Persist processed event ids (unique constraint on `eventId`) so dedup survives
  restarts and concurrent deliveries (catch P2002 = already processed).
- Claim the event BEFORE processing, but if processing (`syncUserPlan`) throws,
  RELEASE the claim and return 500 so Stripe retries reprocess it.

**Why:** the old code used an in-memory `Set` — lost on every restart, so a
restart between two deliveries of the same event caused double plan
activation/charge handling. Naively persisting the claim before processing
flips the bug the other way: a transient failure after the claim makes all
retries look "duplicate" and the billing event is dropped forever (at-most-once).

**How to apply:** `lib/stripe-dedup.ts` exposes `claimStripeEvent` (returns false
if already seen) and `releaseStripeEvent` (deletes the row + mem cache entry on
failure). The route wraps processing in try/catch and releases on error.
