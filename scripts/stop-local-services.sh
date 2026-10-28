#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[Services] Stopping PostgreSQL..."
"$ROOT_DIR/tools/bin/pg_ctl" -D "$ROOT_DIR/data/postgres" stop -m fast 2>/dev/null || true

echo "[Services] Stopping Redis..."
"$ROOT_DIR/tools/bin/redis-cli" shutdown 2>/dev/null || true

echo "[Services] All local services stopped."
