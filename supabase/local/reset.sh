#!/usr/bin/env bash
# Rebuild the local test database from scratch: shim, then every migration in
# order. Exits non-zero on the first failing migration and prints which one.
#
# Usage: supabase/local/reset.sh [dbname]
set -euo pipefail
export LC_ALL=en_US.UTF-8
PG=/opt/homebrew/opt/postgresql@17/bin
DB="${1:-ai_content_test}"
HOST=127.0.0.1
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

"$PG/dropdb" -h "$HOST" --if-exists "$DB"
"$PG/createdb" -h "$HOST" "$DB"
"$PG/psql" -h "$HOST" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/local/00-supabase-shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! "$PG/psql" -h "$HOST" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>/tmp/mig-err.txt; then
    echo "FAILED: $(basename "$f")" >&2
    cat /tmp/mig-err.txt >&2
    exit 1
  fi
done
echo "ok: $(ls "$ROOT"/supabase/migrations/*.sql | wc -l | tr -d ' ') migrations applied to $DB"
