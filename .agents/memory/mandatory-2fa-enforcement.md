---
name: Mandatory 2FA enforcement for privileged roles
description: Why mandatory-2FA for admins must be enforced at the disable mutation route, not just middleware/JWT
---

When a security control is "mandatory for role X" (e.g. 2FA required for ADMIN/OWNER),
enforce it at the **mutation route that could undo it**, not only in middleware or via JWT claims.

**Why:** Middleware that gates on a JWT claim (`token.twoFactorEnabled`) trusts a value that
goes stale between token issuance and DB state. A privileged user could call the disable
endpoint directly; the DB flips to disabled, but the still-valid JWT keeps saying enabled, so
middleware keeps granting access until refresh — defeating "mandatory". OAuth login is a second
bypass surface: NextAuth's second factor lives in CredentialsProvider.authorize(), so the
`signIn` callback must independently block OAuth login for users with 2FA on (fail-closed).

**How to apply:**
- In the disable route, do a DB-backed `user.role` check and return 403 for ADMIN/OWNER BEFORE
  any mutation. Then the disabled state is unreachable for them and the stale-JWT concern is moot.
- Keep middleware as defense-in-depth (block privileged users lacking 2FA from all but
  setup/auth routes), but the route is the source of truth.
- Recovery-code single-use must be atomic: `updateMany({where:{used:false}, data:{used:true}})`
  and accept only when `count===1` — findMany-then-update is a TOCTOU race.
