#!/usr/bin/env bash
set -euo pipefail

# Iran-friendly full setup without modifying existing files
# - Uses docker-compose.ir.yml
# - Uses npm mirror and Playwright mirror at runtime
# - Waits for health checks
# - Verifies DB schema
#
# Usage:
#   bash scripts/full-setup.ir.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE_PATH="docker-compose.ir.yml"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m $*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"; exit 1
  fi
}

# Prefer modern docker compose syntax, fallback to docker-compose
if command -v docker compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  require_cmd docker-compose
  COMPOSE_CMD="docker-compose"
fi

require_cmd docker

info "Using compose file: $COMPOSE_FILE_PATH"

# 1) Build and start
info "Stopping any previous stack (ignore errors)..."
$COMPOSE_CMD -f "$COMPOSE_FILE_PATH" down || true

info "Removing old database volumes to ensure fresh template installation..."
docker volume rm farsnewslatest1_postgres_data 2>/dev/null || true
docker volume rm farsnewslatest1_pgadmin_data 2>/dev/null || true

info "Building and starting services with fresh database template..."
$COMPOSE_CMD -f "$COMPOSE_FILE_PATH" up --build -d

# 2) Wait for Postgres health
PG_CONTAINER="farsnews_postgres"
retries=60
info "Waiting for Postgres health..."
until docker ps --format '{{.Names}} {{.Status}}' | grep -q "^${PG_CONTAINER} .*healthy"; do
  ((retries--)) || { err "Postgres not healthy in time"; docker ps; exit 1; }
  sleep 2
  info "... still waiting for ${PG_CONTAINER}"
done
ok "Postgres is healthy"

# 3) App health and mirror setup inside container
CRAWLER_CONTAINER="farsnews-crawler"
APP_HEALTH="http://localhost:3004/api/health"
retries=60
info "Waiting for app health endpoint..."
until docker exec "$CRAWLER_CONTAINER" wget -q -O- "$APP_HEALTH" >/dev/null 2>&1; do
  ((retries--)) || { err "App did not become healthy"; docker logs "$CRAWLER_CONTAINER" --tail=200 || true; exit 1; }
  sleep 2
  info "... waiting for app"
done
ok "App is healthy"

# 4) Configure mirrors inside container and install Chromium
info "Configuring npm mirror inside container..."
docker exec "$CRAWLER_CONTAINER" bash -lc "npm config set registry https://registry.npmmirror.com || true"

info "Installing Playwright Chromium via mirror (this may take a while)..."
docker exec -e PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright \
  "$CRAWLER_CONTAINER" bash -lc "npx playwright install chromium && npx playwright --version" || {
    warn "Playwright install via mirror failed; retrying once..."
    docker exec -e PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright \
      "$CRAWLER_CONTAINER" bash -lc "npx playwright install chromium && npx playwright --version"
}
ok "Playwright installed"

# 5) Verify DB schema
info "Verifying database schema..."
PSQL="docker exec -e PGPASSWORD=crawler_user $PG_CONTAINER psql -U crawler_user -d farsnews_crawler_spider_db -t -c"
required_tables=(news_sources articles schedules crawl_history crawl_logs performance_metrics queue_jobs admin_users)
missing=()
for t in "${required_tables[@]}"; do
  if ! $PSQL "SELECT to_regclass('public.${t}');" | grep -q "public.${t}"; then
    missing+=("$t")
  fi
done
if ((${#missing[@]} > 0)); then
  warn "Missing tables: ${missing[*]}"
  warn "Database will initialize on first app start if not present; check logs if persists."
else
  ok "All required tables exist"
fi

ok "Iran-friendly setup completed successfully"

echo -e "
Endpoints:
- App:   http://localhost:3004
- Admin: http://localhost:3004/admin
- PgAdmin: http://localhost:8080 (admin@example.com / admin123)"
