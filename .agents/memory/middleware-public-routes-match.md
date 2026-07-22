---
name: Middleware public-route matching
description: Safe way to match public API routes in middleware.ts without prefix impersonation.
---

In `middleware.ts`, public API routes must be matched as exact path or
path-segment prefix, NOT bare substring `startsWith`:

```ts
publicApiRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
```

**Why:** bare `pathname.startsWith(route)` lets `/api/authXYZ` impersonate the
public `/api/auth`, potentially exposing a protected handler. The boundary form
closes that while still allowing tokenized webhook subpaths
(`/api/webhooks/kiwify/<token>`) and NextAuth subpaths (`/api/auth/session`).

**How to apply:** when adding a public route, add its base path to
`publicApiRoutes`; subpaths under it (with `/`) are automatically public.
