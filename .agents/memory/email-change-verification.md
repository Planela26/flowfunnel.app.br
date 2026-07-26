---
name: Email change requires code on CURRENT email
description: Any user.email change must send a verification code to the OLD email and require it back — password alone is not enough proof since a stolen session/session-device attacker can change email and lock out the victim.
---

# Email change requires code on CURRENT email

`POST /api/account/email` historically only required `currentPassword` to authorize an email change. That is NOT sufficient — an attacker with the user's password (or sitting on an authenticated device) could change the email to their own, kick the real owner off, and take over the account via "forgot password" against the new email.

The fix is a 2-step flow with a code sent to the **current** email:

1. `POST /api/account/email/request` — validates password + uniqueness of new email, generates a 6-digit numeric code (`crypto.randomInt` + bcrypt hash + 15min TTL), sends to the CURRENT email via Resend. Returns only the destination address.
2. `POST /api/account/email` — now requires `{ newEmail, code: '000000', currentPassword }`. Looks up `EmailChangeCode` by userId + pendingEmail, bcrypt-compares the code, then password, then applies the change. Code is marked `used: true`. New email remains `emailVerified: null` until they click the link sent to it.

**Why:** the code only reached the rightful owner of the existing inbox, so possession of the code (with password) is proof of control without forcing a separate "verify new email" round trip before the swap.

**How to apply:** any future feature that mutates a critical identifier (email, password reset target, payout account) needs the same code-on-current-identity gate. Don't rely on `currentPassword` alone as authorization for identity-tenant changes — a stolen session = full access regardless.

**Schema:** `EmailChangeCode { userId, codeHash, pendingEmail, expiresAt, used }` with cascade delete from User. Codes accumulate — `deleteMany({ userId, used: false })` before each `create`.

**Cooldowns:** 30s UI countdown on resend; backend rate limits 3 req/min (request) and 5 req/min (confirm).

**OAuth-only users** (`password` null on User) are still blocked from email change entirely — the code path doesn't apply because Google owns the email.
