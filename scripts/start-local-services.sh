#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT_DIR/data/postgres" "$ROOT_DIR/data/redis"

# Start Redis with unix socket and TCP port if not running
if ! "$ROOT_DIR/tools/bin/redis-cli" -s /tmp/redis.sock ping >/dev/null 2>&1; then
  echo "[Services] Starting local Redis..."
  "$ROOT_DIR/tools/bin/redis-server" --daemonize yes --dir "$ROOT_DIR/data/redis" --unixsocket /tmp/redis.sock --unixsocketperm 777 --port 6379
  sleep 1
else
  echo "[Services] Redis is already active."
fi

# Start Postgres if not running
if ! "$ROOT_DIR/tools/bin/psql" -h /tmp -p 5432 -U postgres -d reachinbox -c "SELECT 1" >/dev/null 2>&1; then
  echo "[Services] Starting local PostgreSQL..."
  "$ROOT_DIR/tools/bin/pg_ctl" -D "$ROOT_DIR/data/postgres" -o "-p 5432 -k /tmp" -l "$ROOT_DIR/data/postgres/postgres.log" start
  sleep 1
  "$ROOT_DIR/tools/bin/createdb" -h /tmp -p 5432 -U postgres reachinbox 2>/dev/null || true
else
  echo "[Services] PostgreSQL is already active."
fi

echo "[Services] Local infrastructure ready."
