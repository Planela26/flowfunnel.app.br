---
name: .replit userenv is repo-tracked plaintext
description: Why secrets must never live in [userenv.*] blocks of .replit, and how to move them out.
---

# .replit `[userenv.*]` values are committed plaintext

Anything under `[userenv.shared|development|production]` in `.replit` is stored as
**plaintext in a repo-tracked file**. Putting a credential there (e.g.
`NEXTAUTH_SECRET`) is a secret leak — code review will reject it.

**Why:** `.replit` is versioned; userenv is for non-sensitive config (URLs, price
IDs, public flags), not secrets. Real secrets belong in Replit Secrets, which are
stored separately (not in the repo) and are global (not environment-scoped).

**How to apply:**
- You cannot edit `.replit` directly (the edit tool blocks it). Manage userenv via
  the environment-secrets skill: `deleteEnvVars({keys, environment})` to remove a
  leaked value, `setEnvVars` for non-sensitive config.
- You cannot set a secret value yourself — use `requestEnvVar({requestType:"secret", keys})`
  so the user pastes it into Replit Secrets.
- If the leaked value was a signing secret (NEXTAUTH_SECRET / SESSION_SECRET),
  rotating it **invalidates all existing sessions** → users get a one-time
  `JWT_SESSION_ERROR: decryption operation failed` and must log in again. This is
  expected after rotation, not a bug. Warn the user before rotating.
- Replit's Publish flow handles prod schema diffs; do NOT rely on `[userenv.production]`
  for secrets just because prod needs them — secrets are global and cover prod.
