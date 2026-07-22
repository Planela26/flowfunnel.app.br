#!/bin/bash
# Logical backup (export) of the FlowFunnel PostgreSQL database.
#
# Produces a timestamped, gzipped plain-SQL dump that can be restored into any
# PostgreSQL 16 database with `psql` (see docs/DISASTER_RECOVERY.md).
#
# This is a COMPLEMENT to Replit's built-in managed backups / point-in-time
# recovery — use it for off-platform copies, pre-migration safety dumps, or
# local inspection. It is NOT a replacement for Replit's automated backups.
#
# Usage:
#   bash scripts/db-backup.sh                 # -> backups/flowfunnel_<timestamp>.sql.gz
#   OUT_DIR=/some/path bash scripts/db-backup.sh
#
# Requires: $DATABASE_URL set (auto-set by Replit) and pg_dump (PostgreSQL 16).
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found in PATH." >&2
  exit 1
fi

OUT_DIR="${OUT_DIR:-backups}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$OUT_DIR/flowfunnel_${TS}.sql.gz"

echo ">> Dumping database to $OUT_FILE ..."
# --no-owner / --no-privileges keep the dump portable across roles (Replit's
# managed DB uses a generated role name). --clean --if-exists makes the dump
# safe to re-apply onto an existing schema.
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip -9 > "$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo ">> Backup complete: $OUT_FILE ($SIZE)"
echo ">> Restore with: gunzip -c \"$OUT_FILE\" | psql \"\$TARGET_DATABASE_URL\""
