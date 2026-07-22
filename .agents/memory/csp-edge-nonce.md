---
name: CSP nonce + strict-dynamic breaks Next.js in production
description: Why per-request CSP nonce with 'strict-dynamic' breaks statically-rendered Next.js pages in production while working in dev.
---

# CSP nonce + 'strict-dynamic' breaks Next.js static pages in production

Do NOT use a per-request `nonce` + `'strict-dynamic'` in `script-src` from Next.js middleware.

**Why:** Middleware runs per-request and generates a fresh nonce on every call. But Next.js
pre-renders page HTML at build time (static optimization) with NO nonce baked into the script
tags. With `'strict-dynamic'`, the browser ignores `'self'`/`https:` and only runs scripts
carrying the matching nonce — so every Next.js script gets blocked in production. Result: no
hydration, pages stuck forever on skeleton loaders. It WORKS IN DEV because dev renders all
pages dynamically (nonce stamped onto scripts at render time), so the bug is invisible in the
preview and only shows up in the published app.

**How to apply:** Use `script-src 'self' 'unsafe-inline' https:` (+ `'unsafe-eval'` in dev only).
This is compatible with static pages. Note: when a `nonce` is present in the CSP, browsers IGNORE
`'unsafe-inline'` — so you must remove the nonce entirely for `'unsafe-inline'` to take effect.
Always validate CSP on the PUBLISHED app, not just the dev preview — static-vs-dynamic rendering
differences mean CSP can pass in dev and fail in prod.

(Edge runtime has no `Buffer`; if you ever generate a nonce, use `btoa(crypto.randomUUID())`, not Buffer.)
