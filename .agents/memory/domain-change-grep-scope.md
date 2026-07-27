---
name: Public domain change requires grep across source + dev tools + deploy docs
description: Sweeping find-and-replace of a user-facing domain string misses non-source places; Hostinger env var alignment is the actual critical-path step
---

When the public-facing domain changes (e.g. flowfunnel.app.br → flowsara.com.br), a flat `grep -rln <old>` only catches code. The full sweep must include:

**Source files** — `*.ts`, `*.tsx`, `*.js`, `*.html`, `*.md`, `package.json` (if any URL is hardcoded).

**Replit dev config** — `.replit` `[userenv.shared]` block. This file is repo-tracked (see replit-userenv-secret-leak), so URLs leak through git even though they're only read by the dev box. Update via `writeFile(.replit.new)` + `verifyAndReplaceDotReplit`, never Edit directly.

**Deploy documentation** — `HOSTINGER_DEPLOY.md`, `DEPLOY.md`, any README/nginx config snippets. The deploy procedure will be re-run later; stale URLs there cause confusion even if the live app is right.

**Email defaults** — `lib/email.ts` `FROM_EMAIL` and `APP_URL` fallback constants. Resend rejects the send if the domain isn't verified, so swap order matters: domain first, then `RESEND_FROM_EMAIL`.

**Stable identifiers stay** — the GitHub repo name (`Planela26/<old>.git`) and any namespace strings used for tenant resolution. Changing the repo URL is GitHub-transfer flow, not a code edit.

**Critical-path alignment** (NOT in code, in environment):
- `NEXTAUTH_URL` on Hostinger MUST match the new domain or `getBaseUrl()` throws and the app refuses to start at first request requiring it.
- DNS for the new domain must point to Hostinger (A-record or CNAME via Registro.br).
- `RESEND_FROM_EMAIL` domain must be verified at resend.com/domains before transactional emails start delivering.

**Why:** The 503 the user hit on the Hostinger side was caused by `NEXTAUTH_URL` being out of sync with the actual served URL — the code change alone isn't sufficient, the env in Hostinger's hPanel has to be manually updated.
**How to apply:** On any domain rebrand, deliver code commits + a checklist message for the user (Registrar.br + Hostinger hPanel + Resend verification). The code commit is the easy half.
