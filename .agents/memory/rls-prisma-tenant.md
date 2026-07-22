---
name: Prisma RLS multi-tenant (per-operation extension + ALS)
description: Pitfalls when enforcing Postgres RLS through a Prisma $extends tenant client driven by AsyncLocalStorage.
---

# Postgres RLS via Prisma tenant client

Pattern: one base PrismaClient → `prismaAdmin` (bypass, stays superuser/BYPASSRLS) +
`prisma = base.$extends(rls)` where every operation runs inside a tx that does
`set_config('app.current_user_id', …)` + `SET LOCAL ROLE app_rls` (a NOBYPASSRLS role).
Tenant id resolved by `resolveTenantUserId()`: AsyncLocalStorage override
(`runWithTenant`) → else decode the NextAuth session cookie. Unresolved → empty GUC →
0 rows / writes denied (fail-closed).

## Pitfall: must await INSIDE the ALS scope
Prisma ops are **lazy** (`PrismaPromise` only executes when awaited). `runWithTenant(id, fn)`
must `await fn()` *inside* `als.run(...)`. If you return the promise and await it outside
the scope, the tenant resolves null at execution time → everything fail-closes wrongly.

**Why:** the extension reads the ALS value when the query actually runs, not when it's
constructed.

## Pitfall: $transaction array form bypasses the extension
`prisma.$transaction([op1, op2])` (array form) does NOT compose with a per-operation
`$extends` — the RLS context isn't set. Use a `withTenantTx(fn)` helper (interactive tx
that sets the GUC + role once) instead.

## System / public flows must use prismaAdmin
auth/*, webhooks/*, cron/*, admin/*, track/{event,conversion}, stripe/webhook,
mercadopago/*, affiliate public flows, and the dedup/webhook-logger libs have NO tenant
session → route them to `prismaAdmin` or they fail-closed. Same for the NextAuth adapter.

## User table: self-only RLS + bypass for legitimate cross-user reads
Don't leave `User` without RLS "so the tenant can read its profile" — that breaks absolute
isolation. Give `User` a self-only policy (`id = current_setting('app.current_user_id')`).
The few genuine cross-user reads (email-uniqueness check, card-fingerprint anti-fraud) must
use `prismaAdmin`, since a self-only policy would hide other users and silently break them.

**How to apply:** when adding a new tenant route, default to `prisma`; only reach for
`prismaAdmin` when the read genuinely needs to see other tenants/users, and document why
inline. Keep `__tests__/rls.test.ts` (self / cross-tenant denied / no-context denied /
admin bypass) as a CI gate for any migration touching tenant tables.
