# FlowFunnel — Disaster Recovery (DR) Runbook

How to recover the FlowFunnel database and application after data loss,
corruption, a bad migration, or accidental deletion.

## Recovery objectives

| Objective | Target | Backed by |
|---|---|---|
| **RPO** (max acceptable data loss) | ~24h with the logical export below; **near-zero** with Replit's managed backups / PITR | Replit managed Postgres backups + `scripts/db-backup.sh` |
| **RTO** (max acceptable downtime) | < 1h | Restore procedures below |

The primary recovery mechanism is **Replit's built-in managed PostgreSQL
backups** (automatic, point-in-time). The logical `pg_dump` export
(`scripts/db-backup.sh`) is a **complement** for off-platform copies and
pre-migration safety dumps.

## What to protect

- **Database** (PostgreSQL via Replit) — all business data: users, funnels,
  events, integrations, snapshots, webhook logs, tracking, billing state.
- **Secrets / env vars** — `DATABASE_URL`, `NEXTAUTH_SECRET`, Stripe keys,
  `RESEND_API_KEY`, `CRON_SECRET`, webhook secrets, Google OAuth. These live in
  Replit Secrets, NOT in the database — record that they exist (never their
  values) so they can be re-provisioned.
- **Code** — version-controlled (git checkpoints).

## Backup strategy

### 1. Replit managed backups (primary)
Replit's built-in Postgres provides automatic backups and point-in-time
recovery. Use the Database pane in the Replit workspace to view available
restore points and restore. This is the lowest-RPO option.

### 2. Logical export (complement) — `scripts/db-backup.sh`
A timestamped, gzipped plain-SQL dump for off-platform storage, migrations, or
inspection:

```bash
bash scripts/db-backup.sh           # -> backups/flowfunnel_<timestamp>.sql.gz
OUT_DIR=/custom/path bash scripts/db-backup.sh
```

Run it **before any risky operation** (schema migration, bulk data change,
dependency upgrade affecting the data layer). Download the resulting file out of
Replit for true off-site safety. Recommended cadence if used as a scheduled
safety net: daily (gives ~24h RPO on its own).

## Restore procedures

### A. Restore from Replit managed backup (preferred)
1. Stop writes if possible (pause the deployment / cron schedules).
2. In the Replit Database pane, choose the desired restore point and restore.
3. Run post-restore setup (below).

### B. Restore from a logical dump
1. Provision/identify the target database and export its URL:
   ```bash
   export TARGET_DATABASE_URL="postgresql://..."
   ```
2. Apply the dump (it uses `DROP ... IF EXISTS` + `CREATE`, so it overwrites
   matching objects):
   ```bash
   gunzip -c backups/flowfunnel_<timestamp>.sql.gz | psql "$TARGET_DATABASE_URL"
   ```
3. Run post-restore setup (below).

### Post-restore setup (both paths)
1. Confirm/refresh secrets in Replit Secrets (see "What to protect").
2. Bring the schema ledger in sync and regenerate the client:
   ```bash
   bash scripts/db-migrate-deploy.sh
   npx prisma generate
   ```
3. Restart the app workflow (`Start application`) and smoke-test:
   - Login / dashboard load
   - A webhook (e.g. Stripe) and the WhatsApp QR flow
   - `/billing` and a report export
4. Re-enable cron scheduled deployments (`/api/cron/snapshot`,
   `/api/cron/alerts`).

## Bad-migration recovery
1. Restore the database (path A or B) to a point before the migration.
2. Fix the offending migration in `prisma/migrations/` (all migrations are
   idempotent — `IF NOT EXISTS` / `IF EXISTS`).
3. Re-apply with `bash scripts/db-migrate-deploy.sh`.

## Verification (do this periodically, not only during an incident)
- Run `scripts/db-backup.sh` and confirm a non-empty `.sql.gz` is produced.
- Restore the dump into a throwaway database and confirm key tables have rows.
- An untested backup is not a backup.
